(() => {
  "use strict";
  const {client, bucket} = window.CSDICMemberClient;
  async function deleteDocument(id, title) {
    if (!client) throw new Error("MEMBER_SERVICE_UNAVAILABLE");
    if (!window.confirm('“' + title + '” 문서와 원본 파일을 삭제할까요?\n삭제한 자료는 복구할 수 없습니다.')) return false;
    // Revoke member access before touching the file. RLS allows only a verified admin.
    const hidden = await client.from("member_documents").update({published:false}).eq("id",id).select("id,object_path").single();
    if (hidden.error) throw hidden.error;
    if (hidden.data?.id !== id || typeof hidden.data.object_path !== "string") throw new Error("DOCUMENT_NOT_FOUND");
    try {
      // Use the Storage API: deleting metadata with SQL would leave the stored file behind.
      const file = await client.storage.from(bucket).remove([hidden.data.object_path]);
      if (file.error) throw file.error;
      const record = await client.from("member_documents").delete().eq("id",id).select("id").single();
      if (record.error) throw record.error;
      if (record.data?.id !== id) throw new Error("DOCUMENT_DELETE_NOT_CONFIRMED");
      // Per-member grants are removed by the database's ON DELETE CASCADE.
      return true;
    } catch {
      const error = new Error("DOCUMENT_DELETE_INCOMPLETE");
      error.documentHidden = true;
      throw error;
    }
  }
  window.CSDICMemberDocumentActions = Object.freeze({deleteDocument});
})();
