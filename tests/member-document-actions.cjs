const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname,'../member-document-actions.js'),'utf8');
const id = '10000000-0000-0000-0000-000000000001';
const path = id + '.pdf';
function setup({confirm = true, fail = '', missingFile = false} = {}) {
  const calls = [];
  const client = {
    from(table) {
      assert.equal(table, 'member_documents');
      let operation;
      return {
        update(values) {operation = 'hide'; assert.equal(values.published,false); return this;},
        delete() {operation = 'delete-record'; return this;},
        eq(column,value) {assert.equal(column,'id'); assert.equal(value,id); return this;},
        select() {return this;},
        async single() {
          calls.push(operation);
          return fail === operation ? {error:new Error('denied')} : {data:{id,object_path:path}};
        }
      };
    },
    storage: {from(bucket) {
      assert.equal(bucket,'member-documents');
      return {async remove(paths) {
        assert.deepEqual(Array.from(paths),[path]);
        calls.push('delete-file');
        return fail === 'delete-file' ? {error:new Error('network error')} : {data:missingFile ? [] : [{name:path}]};
      }};
    }}
  };
  const window = {CSDICMemberClient:{client,bucket:'member-documents'},confirm:message => {
    assert.match(message,/복구할 수 없습니다/);
    calls.push('confirmation');
    return confirm;
  }};
  vm.runInNewContext(source,{window});
  return {run:()=>window.CSDICMemberDocumentActions.deleteDocument(id,'테스트'),calls};
}
(async () => {
  const cancelled = setup({confirm:false});
  assert.equal(await cancelled.run(),false);
  assert.deepEqual(cancelled.calls,['confirmation']);
  const denied = setup({fail:'hide'});
  await assert.rejects(denied.run(),/denied/);
  assert.deepEqual(denied.calls,['confirmation','hide']);
  const storageFailure = setup({fail:'delete-file'});
  await assert.rejects(storageFailure.run(),error=>error.documentHidden===true);
  assert.deepEqual(storageFailure.calls,['confirmation','hide','delete-file']);
  const recordFailure = setup({fail:'delete-record'});
  await assert.rejects(recordFailure.run(),error=>error.documentHidden===true);
  const success = setup();
  assert.equal(await success.run(),true);
  assert.deepEqual(success.calls,['confirmation','hide','delete-file','delete-record']);
  const retry = setup({missingFile:true});
  assert.equal(await retry.run(),true);
  console.log('PASS: cancellation leaves data intact; denied admins cannot delete files; file failure preserves hidden records; incomplete deletes are retryable.');
})().catch(error=>{console.error(error);process.exitCode=1;});
