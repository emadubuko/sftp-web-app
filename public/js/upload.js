(function () {
  const uploadInput = document.getElementById('upload-input');
  const progressSection = document.getElementById('upload-progress');
  const progressBar = document.getElementById('upload-progress-bar');
  const progressLabel = document.querySelector('.upload-progress-label');

  let allowedExtensions = null;

  function getExtension(filename) {
    const dot = filename.lastIndexOf('.');
    return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
  }

  function setAllowedExtensions(extensions) {
    allowedExtensions = Array.isArray(extensions) ? extensions.map((e) => e.toLowerCase()) : null;
    uploadInput.accept = allowedExtensions ? allowedExtensions.map((e) => `.${e}`).join(',') : '';
  }

  function uploadFile(file, destPath) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/files/upload?path=${encodeURIComponent(destPath || '')}`);

      xhr.upload.addEventListener('progress', (event) => {
        if (!event.lengthComputable) return;
        const pct = Math.round((event.loaded / event.total) * 100);
        progressBar.value = pct;
        progressLabel.textContent = `Uploading ${file.name}... ${pct}%`;
      });

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          let message = 'Upload failed';
          try {
            message = JSON.parse(xhr.responseText).error || message;
          } catch {
            /* ignore parse failure */
          }
          reject(new Error(message));
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed'));

      xhr.send(formData);
    });
  }

  uploadInput.addEventListener('change', async () => {
    const file = uploadInput.files[0];
    if (!file) return;

    // Client-side check is for immediate feedback only — the server
    // enforces the same allowlist regardless, since this can be bypassed.
    if (allowedExtensions) {
      const ext = getExtension(file.name);
      if (!ext || !allowedExtensions.includes(ext)) {
        window.alert(
          `File type "${ext ? `.${ext}` : '(none)'}" is not allowed. Allowed types: ${allowedExtensions.join(', ')}`
        );
        uploadInput.value = '';
        return;
      }
    }

    progressSection.classList.remove('hidden');
    progressBar.value = 0;
    progressLabel.textContent = `Uploading ${file.name}... 0%`;

    try {
      await uploadFile(file, window.browserApp.getCurrentPath());
      await window.browserApp.refresh();
    } catch (err) {
      window.alert(err.message);
    } finally {
      progressSection.classList.add('hidden');
      uploadInput.value = '';
    }
  });

  window.uploadApp = { setAllowedExtensions };
})();
