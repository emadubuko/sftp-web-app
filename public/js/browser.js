(function () {
  const breadcrumbsEl = document.getElementById('breadcrumbs');
  const fileListEl = document.getElementById('file-list');
  const emptyStateEl = document.getElementById('empty-state');
  const newFolderBtn = document.getElementById('new-folder-btn');

  let currentPath = '';

  function formatSize(bytes) {
    if (bytes === null || bytes === undefined) return '';
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = -1;
    do {
      value /= 1024;
      unitIndex += 1;
    } while (value >= 1024 && unitIndex < units.length - 1);
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString();
  }

  function renderBreadcrumbs(breadcrumbs) {
    breadcrumbsEl.innerHTML = '';
    breadcrumbs.forEach((crumb, index) => {
      if (index > 0) {
        const sep = document.createElement('span');
        sep.className = 'sep';
        sep.textContent = '/';
        breadcrumbsEl.appendChild(sep);
      }
      const isLast = index === breadcrumbs.length - 1;
      const node = document.createElement(isLast ? 'span' : 'a');
      node.textContent = crumb.name;
      if (!isLast) {
        node.addEventListener('click', () => navigate(crumb.path));
      }
      breadcrumbsEl.appendChild(node);
    });
  }

  function renderEntries(entries) {
    fileListEl.innerHTML = '';
    emptyStateEl.classList.toggle('hidden', entries.length > 0);

    entries.forEach((entry) => {
      const row = document.createElement('tr');
      row.className = 'entry-row';

      const nameCell = document.createElement('td');
      const label = (entry.type === 'directory' ? '📁 ' : '📄 ') + entry.name;
      if (entry.type === 'directory') {
        const link = document.createElement('a');
        link.className = 'entry-link';
        link.textContent = label;
        const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        link.addEventListener('click', () => navigate(entryPath));
        nameCell.appendChild(link);
      } else {
        const span = document.createElement('span');
        span.textContent = label;
        nameCell.appendChild(span);
      }
      row.appendChild(nameCell);

      const sizeCell = document.createElement('td');
      sizeCell.textContent = entry.type === 'file' ? formatSize(entry.size) : '';
      row.appendChild(sizeCell);

      const modifiedCell = document.createElement('td');
      modifiedCell.textContent = formatDate(entry.modifiedAt);
      row.appendChild(modifiedCell);

      fileListEl.appendChild(row);
    });
  }

  async function navigate(pathValue) {
    const listing = await api.listFiles(pathValue);
    currentPath = listing.path;
    renderBreadcrumbs(listing.breadcrumbs);
    renderEntries(listing.entries);
  }

  function refresh() {
    return navigate(currentPath);
  }

  newFolderBtn.addEventListener('click', async () => {
    const name = window.prompt('New folder name:');
    if (!name) return;
    try {
      await api.mkdir(currentPath, name);
      await refresh();
    } catch (err) {
      window.alert(err.message);
    }
  });

  window.browserApp = {
    navigate,
    refresh,
    getCurrentPath: () => currentPath,
  };
})();
