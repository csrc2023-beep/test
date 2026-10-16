(() => {
  "use strict";
  const extensions = Object.freeze({"image/webp":"webp", "image/png":"png", "image/jpeg":"jpg"});
  const maxSide = 1920;

  async function decode(file) {
    if (typeof window.createImageBitmap === "function") {
      try {
        const bitmap = await window.createImageBitmap(file, {imageOrientation:"from-image"});
        return {source:bitmap, width:bitmap.width, height:bitmap.height, release:() => bitmap.close()};
      } catch { /* Older browsers can still decode through an image element. */ }
    }
    const url = URL.createObjectURL(file), image = new Image();
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });
      return {source:image, width:image.naturalWidth, height:image.naturalHeight,
        release:() => {image.src = ""; URL.revokeObjectURL(url);}};
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }

  async function optimize(file) {
    let decoded, canvas;
    try {
      decoded = await decode(file);
      const {width, height} = decoded;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width * height > 60000000) throw new Error("INVALID_DIMENSIONS");
      const scale = Math.min(1, maxSide / Math.max(width, height));
      canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("CANVAS_UNAVAILABLE");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve, reject) => {
        try {canvas.toBlob(resolve, "image/webp", 0.8);} catch (error) {reject(error);}
      });
      // Browsers without a WebP encoder may return PNG. Use its actual MIME type.
      if (!blob || !Object.hasOwn(extensions, blob.type) || blob.size < 1) throw new Error("ENCODING_FAILED");
      if (blob.size >= file.size) return file;
      const name = file.name.replace(/\.[^.]+$/, "") + "." + extensions[blob.type];
      return new File([blob], name, {type:blob.type, lastModified:file.lastModified});
    } catch {
      throw new Error("IMAGE_PROCESSING_FAILED");
    } finally {
      decoded?.release();
      if (canvas) {canvas.width = 1; canvas.height = 1;}
    }
  }
  window.CSDICCommunityImage = Object.freeze({optimize});
})();
