const API = '/api/tasks';
const $ = id => document.getElementById(id);

const STATUS_LABEL = { PENDING: 'Pending', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed' };
const PRIORITY_LABEL = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };

// current sort state
let sortBy = 'dueDate';
let dir = 'asc';

// ---------- Error handling ----------
let errTimer;
function showError(msg) {
  const b = $('errorBanner');
  b.textContent = msg;
  b.hidden = false;
  clearTimeout(errTimer);
  errTimer = setTimeout(() => { b.hidden = true; }, 5000);
}

// fetch wrapper: throws a readable Error on network failure or non-2xx response
async function api(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (e) {
    throw new Error('Cannot reach the server. Is the application running?');
  }
  if (!res.ok) {
    let data = {};
    try { data = await res.json(); } catch (e) { /* response had no JSON body */ }
    const err = new Error(data.error || ('Request failed (' + res.status + ')'));
    err.status = res.status;
    err.fields = data.fields;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

// ---------- Loading data ----------
async function loadStats() {
  try {
    const s = await api(API + '/stats');
    $('statTotal').textContent = s.total;
    $('statPending').textContent = s.pending;
    $('statInProgress').textContent = s.inProgress;
    $('statCompleted').textContent = s.completed;
  } catch (e) {
    showError(e.message);
  }
}

async function loadTasks() {
  const params = new URLSearchParams();
  if ($('search').value.trim()) params.set('search', $('search').value.trim());
  if ($('filterStatus').value) params.set('status', $('filterStatus').value);
  if ($('filterPriority').value) params.set('priority', $('filterPriority').value);
  if ($('filterAssignee').value.trim()) params.set('assignedTo', $('filterAssignee').value.trim());
  params.set('sortBy', sortBy);
  params.set('dir', dir);

  let tasks;
  try {
    tasks = await api(API + '?' + params);
  } catch (e) {
    showError(e.message);
    return;
  }

  const body = $('taskBody');
  body.innerHTML = '';
  $('emptyMsg').hidden = tasks.length > 0;

  const today = new Date().toISOString().slice(0, 10);
  tasks.forEach(t => {
    const tr = document.createElement('tr');
    const overdue = t.status !== 'COMPLETED' && t.dueDate < today;

    tr.appendChild(cell(t.title));
    tr.appendChild(cell(t.description || '-'));
    tr.appendChild(cell(t.assignedTo || 'Unassigned'));

    const pTd = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'badge ' + t.priority;
    badge.textContent = PRIORITY_LABEL[t.priority];
    pTd.appendChild(badge);
    tr.appendChild(pTd);

    // status dropdown -> change status directly
    const sTd = document.createElement('td');
    const sel = document.createElement('select');
    Object.keys(STATUS_LABEL).forEach(k => {
      sel.appendChild(new Option(STATUS_LABEL[k], k, false, k === t.status));
    });
    sel.onchange = () => changeStatus(t.id, sel.value);
    sTd.appendChild(sel);
    tr.appendChild(sTd);

    const dTd = cell(t.dueDate + (overdue ? ' (overdue)' : ''));
    if (overdue) dTd.className = 'overdue';
    tr.appendChild(dTd);

    const aTd = document.createElement('td');
    aTd.appendChild(button('Edit', 'small', () => startEdit(t)));
    aTd.appendChild(button('Delete', 'small danger', () => deleteTask(t.id, t.title)));
    tr.appendChild(aTd);

    body.appendChild(tr);
  });
}

function cell(text) { const td = document.createElement('td'); td.textContent = text; return td; }
function button(text, cls, onclick) {
  const b = document.createElement('button');
  b.textContent = text; b.className = cls; b.type = 'button'; b.onclick = onclick;
  return b;
}
function refresh() { loadStats(); loadTasks(); }

// ---------- Sorting ----------
function updateHeaders() {
  document.querySelectorAll('th.sortable').forEach(th => {
    const arrow = th.dataset.sort === sortBy ? (dir === 'asc' ? ' ▲' : ' ▼') : '';
    th.textContent = th.dataset.label + arrow;
  });
}

document.querySelectorAll('th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    if (sortBy === th.dataset.sort) {
      dir = dir === 'asc' ? 'desc' : 'asc';   // same column -> flip direction
    } else {
      sortBy = th.dataset.sort;
      dir = 'asc';
    }
    updateHeaders();
    loadTasks();
  });
});

// ---------- Form ----------
function validate() {
  let ok = true;
  $('err-title').textContent = '';
  $('err-dueDate').textContent = '';

  if (!$('title').value.trim()) { $('err-title').textContent = 'Title is required'; ok = false; }

  const d = $('dueDate').value;
  if (!d) { $('err-dueDate').textContent = 'Due date is required'; ok = false; }
  else if (isNaN(new Date(d).getTime())) { $('err-dueDate').textContent = 'Invalid date'; ok = false; }
  return ok;
}

$('taskForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!validate()) return;

  const id = $('taskId').value;
  const task = {
    title: $('title').value.trim(),
    description: $('description').value.trim(),
    assignedTo: $('assignedTo').value.trim(),
    priority: $('priority').value,
    status: $('status').value,
    dueDate: $('dueDate').value
  };

  try {
    await api(id ? `${API}/${id}` : API, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    });
  } catch (err) {
    if (err.fields) {                       // backend validation errors -> show under fields
      if (err.fields.title) $('err-title').textContent = err.fields.title;
      if (err.fields.dueDate) $('err-dueDate').textContent = err.fields.dueDate;
      if (err.fields.assignedTo) showError(err.fields.assignedTo);
    } else {
      showError(err.message);
      if (err.status === 404) { resetForm(); refresh(); }   // task was deleted elsewhere
    }
    return;
  }
  resetForm();
  refresh();
});

function startEdit(t) {
  $('formTitle').textContent = 'Edit Task';
  $('saveBtn').textContent = 'Update Task';
  $('cancelBtn').hidden = false;
  $('taskId').value = t.id;
  $('title').value = t.title;
  $('description').value = t.description || '';
  $('assignedTo').value = t.assignedTo || '';
  $('priority').value = t.priority;
  $('status').value = t.status;
  $('dueDate').value = t.dueDate;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  $('taskForm').reset();
  $('taskId').value = '';
  $('formTitle').textContent = 'Add Task';
  $('saveBtn').textContent = 'Add Task';
  $('cancelBtn').hidden = true;
  $('err-title').textContent = '';
  $('err-dueDate').textContent = '';
}
$('cancelBtn').onclick = resetForm;

// ---------- Actions ----------
async function changeStatus(id, status) {
  try {
    await api(`${API}/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
  } catch (e) {
    showError(e.message);
  }
  refresh();   // always reload so the table matches the server
}

async function deleteTask(id, title) {
  if (!confirm(`Delete task "${title}"?`)) return;
  try {
    await api(`${API}/${id}`, { method: 'DELETE' });
  } catch (e) {
    showError(e.message);
  }
  refresh();
}

// ---------- Search & filters ----------
let timer;
function debouncedLoad() { clearTimeout(timer); timer = setTimeout(loadTasks, 250); }
$('search').addEventListener('input', debouncedLoad);
$('filterAssignee').addEventListener('input', debouncedLoad);
$('filterStatus').onchange = loadTasks;
$('filterPriority').onchange = loadTasks;

updateHeaders();
refresh();