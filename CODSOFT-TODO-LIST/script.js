document.addEventListener('DOMContentLoaded', () => {

  /* ============================================================
     STATE
  ============================================================ */
  const STORAGE_KEY = 'todoAppTasks';
  const THEME_KEY = 'todoAppTheme';

  let tasks = [];
  let currentFilter = 'all';
  let currentSearch = '';
  let editingTaskId = null;
  let deletingTaskId = null;

  /* ============================================================
     DOM REFERENCES
  ============================================================ */
  const taskForm = document.getElementById('taskForm');
  const taskTitleInput = document.getElementById('taskTitle');
  const taskDescriptionInput = document.getElementById('taskDescription');
  const taskCategoryInput = document.getElementById('taskCategory');
  const taskPriorityInput = document.getElementById('taskPriority');
  const taskDueDateInput = document.getElementById('taskDueDate');
  const titleError = document.getElementById('titleError');

  const taskList = document.getElementById('taskList');
  const emptyState = document.getElementById('emptyState');
  const emptyTitle = document.getElementById('emptyTitle');
  const emptyText = document.getElementById('emptyText');

  const statTotal = document.getElementById('statTotal');
  const statCompleted = document.getElementById('statCompleted');
  const statPending = document.getElementById('statPending');

  const searchInput = document.getElementById('searchInput');
  const filterBtns = document.querySelectorAll('.filter-btn');

  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const themeLabel = document.getElementById('themeLabel');

  const editModalOverlay = document.getElementById('editModalOverlay');
  const editForm = document.getElementById('editForm');
  const editTitleInput = document.getElementById('editTitle');
  const editDescriptionInput = document.getElementById('editDescription');
  const editCategoryInput = document.getElementById('editCategory');
  const editPriorityInput = document.getElementById('editPriority');
  const editDueDateInput = document.getElementById('editDueDate');
  const editTitleError = document.getElementById('editTitleError');
  const cancelEditBtn = document.getElementById('cancelEditBtn');

  const deleteModalOverlay = document.getElementById('deleteModalOverlay');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

  /* ============================================================
     LOCAL STORAGE — LOAD / SAVE
  ============================================================ */
  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      tasks = raw ? JSON.parse(raw) : [];
    } catch (e) {
      tasks = [];
    }
  }

  function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function loadTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark') {
      document.body.classList.add('dark');
    }
    updateThemeToggleUI();
  }

  function saveTheme() {
    localStorage.setItem(THEME_KEY, document.body.classList.contains('dark') ? 'dark' : 'light');
  }

  function updateThemeToggleUI() {
    const isDark = document.body.classList.contains('dark');
    themeIcon.textContent = isDark ? '\u2600' : '\u263D';
    themeLabel.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    themeToggle.setAttribute('aria-pressed', String(isDark));
  }

  /* ============================================================
     UTILITIES
  ============================================================ */
  function generateId() {
    return 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDueDate(dueDateStr) {
    if (!dueDateStr) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(dueDateStr + 'T00:00:00');
    const diffMs = due.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { label: 'Due Today', state: 'today' };
    if (diffDays === 1) return { label: 'Due Tomorrow', state: 'upcoming' };
    if (diffDays < 0) return { label: 'Overdue', state: 'overdue' };

    const formatted = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return { label: `Due ${formatted}`, state: 'upcoming' };
  }

  /* ============================================================
     VALIDATION
  ============================================================ */
  function validateTitle(value, errorEl, inputEl) {
    const trimmed = value.trim();
    if (!trimmed) {
      errorEl.textContent = 'Please enter a task title.';
      errorEl.classList.add('show');
      inputEl.focus();
      return null;
    }
    errorEl.textContent = '';
    errorEl.classList.remove('show');
    return trimmed;
  }

  /* ============================================================
     ADD TASK
  ============================================================ */
  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const title = validateTitle(taskTitleInput.value, titleError, taskTitleInput);
    if (title === null) return;

    const newTask = {
      id: generateId(),
      title: title,
      description: taskDescriptionInput.value.trim(),
      category: taskCategoryInput.value,
      priority: taskPriorityInput.value,
      dueDate: taskDueDateInput.value || '',
      completed: false,
      createdAt: Date.now()
    };

    tasks.unshift(newTask);
    saveTasks();
    renderTasks();
    updateStats();

    taskForm.reset();
    taskPriorityInput.value = 'Medium';
    taskTitleInput.focus();
  });

  // Clear title error as the user types
  taskTitleInput.addEventListener('input', () => {
    if (titleError.classList.contains('show') && taskTitleInput.value.trim()) {
      titleError.textContent = '';
      titleError.classList.remove('show');
    }
  });

  /* ============================================================
     RENDER TASKS (applies search + filter together)
  ============================================================ */
  function getFilteredTasks() {
    const query = currentSearch.trim().toLowerCase();

    return tasks.filter(task => {
      // --- Filter ---
      let passesFilter = true;
      if (currentFilter === 'pending') passesFilter = !task.completed;
      else if (currentFilter === 'completed') passesFilter = task.completed;
      else if (currentFilter === 'high') passesFilter = task.priority === 'High';

      if (!passesFilter) return false;

      // --- Search ---
      if (!query) return true;
      const haystack = [
        task.title,
        task.description || '',
        task.category || ''
      ].join(' ').toLowerCase();

      return haystack.includes(query);
    });
  }

  function renderTasks() {
    const visibleTasks = getFilteredTasks();

    taskList.innerHTML = '';

    if (tasks.length === 0) {
      emptyState.classList.add('show');
      emptyTitle.textContent = 'No tasks yet';
      emptyText.textContent = 'Add your first task and start organizing your day.';
      return;
    }

    if (visibleTasks.length === 0) {
      emptyState.classList.add('show');
      emptyTitle.textContent = 'No matching tasks found.';
      emptyText.textContent = 'Try adjusting your search or filter.';
      return;
    }

    emptyState.classList.remove('show');

    visibleTasks.forEach(task => {
      taskList.appendChild(buildTaskCard(task));
    });
  }

  function buildTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card' + (task.completed ? ' completed' : '');
    card.dataset.id = task.id;

    const dueInfo = formatDueDate(task.dueDate);

    const priorityClass = task.priority === 'High'
      ? 'tag-priority-high'
      : task.priority === 'Medium'
        ? 'tag-priority-medium'
        : 'tag-priority-low';

    let dueTagHtml = '';
    if (dueInfo) {
      const dueClass = dueInfo.state === 'overdue'
        ? 'tag-due-overdue'
        : dueInfo.state === 'today'
          ? 'tag-due-today'
          : '';
      dueTagHtml = `<span class="tag ${dueClass}">${escapeHtml(dueInfo.label)}</span>`;
    }

    card.innerHTML = `
      <label class="task-checkbox">
        <input type="checkbox" ${task.completed ? 'checked' : ''} aria-label="Mark task as ${task.completed ? 'pending' : 'completed'}">
        <span class="checkbox-visual"></span>
      </label>
      <div class="task-body">
        <div class="task-title-row">
          <span class="task-title">${escapeHtml(task.title)}</span>
        </div>
        ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
        <div class="task-meta">
          <span class="tag">${escapeHtml(task.category)}</span>
          <span class="tag ${priorityClass}">${escapeHtml(task.priority)} Priority</span>
          ${dueTagHtml}
        </div>
      </div>
      <div class="task-actions">
        <button type="button" class="icon-btn edit-btn">Edit</button>
        <button type="button" class="icon-btn delete-btn">Delete</button>
      </div>
    `;

    // Toggle complete/pending
    const checkbox = card.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => {
      toggleTaskCompletion(task.id);
    });

    // Edit
    card.querySelector('.edit-btn').addEventListener('click', () => {
      openEditModal(task.id);
    });

    // Delete
    card.querySelector('.delete-btn').addEventListener('click', () => {
      openDeleteModal(task.id);
    });

    return card;
  }

  /* ============================================================
     TOGGLE COMPLETE / PENDING
  ============================================================ */
  function toggleTaskCompletion(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    task.completed = !task.completed;
    saveTasks();
    renderTasks();
    updateStats();
  }

  /* ============================================================
     EDIT TASK
  ============================================================ */
  function openEditModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    editingTaskId = taskId;

    editTitleInput.value = task.title;
    editDescriptionInput.value = task.description || '';
    editCategoryInput.value = task.category;
    editPriorityInput.value = task.priority;
    editDueDateInput.value = task.dueDate || '';

    editTitleError.textContent = '';
    editTitleError.classList.remove('show');

    editModalOverlay.classList.add('show');
    setTimeout(() => editTitleInput.focus(), 100);
  }

  function closeEditModal() {
    editModalOverlay.classList.remove('show');
    editingTaskId = null;
  }

  editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!editingTaskId) return;

    const title = validateTitle(editTitleInput.value, editTitleError, editTitleInput);
    if (title === null) return;

    const task = tasks.find(t => t.id === editingTaskId);
    if (!task) return;

    task.title = title;
    task.description = editDescriptionInput.value.trim();
    task.category = editCategoryInput.value;
    task.priority = editPriorityInput.value;
    task.dueDate = editDueDateInput.value || '';

    saveTasks();
    renderTasks();
    updateStats();
    closeEditModal();
  });

  editTitleInput.addEventListener('input', () => {
    if (editTitleError.classList.contains('show') && editTitleInput.value.trim()) {
      editTitleError.textContent = '';
      editTitleError.classList.remove('show');
    }
  });

  cancelEditBtn.addEventListener('click', closeEditModal);
  editModalOverlay.addEventListener('click', (e) => {
    if (e.target === editModalOverlay) closeEditModal();
  });

  /* ============================================================
     DELETE TASK
  ============================================================ */
  function openDeleteModal(taskId) {
    deletingTaskId = taskId;
    deleteModalOverlay.classList.add('show');
  }

  function closeDeleteModal() {
    deleteModalOverlay.classList.remove('show');
    deletingTaskId = null;
  }

  confirmDeleteBtn.addEventListener('click', () => {
    if (!deletingTaskId) return;
    tasks = tasks.filter(t => t.id !== deletingTaskId);
    saveTasks();
    renderTasks();
    updateStats();
    closeDeleteModal();
  });

  cancelDeleteBtn.addEventListener('click', closeDeleteModal);
  deleteModalOverlay.addEventListener('click', (e) => {
    if (e.target === deleteModalOverlay) closeDeleteModal();
  });

  /* ============================================================
     GLOBAL ESCAPE KEY FOR MODALS
  ============================================================ */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEditModal();
      closeDeleteModal();
    }
  });

  /* ============================================================
     SEARCH
  ============================================================ */
  searchInput.addEventListener('input', () => {
    currentSearch = searchInput.value;
    renderTasks();
  });

  /* ============================================================
     FILTERING
  ============================================================ */
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  /* ============================================================
     STATISTICS
  ============================================================ */
  function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;

    statTotal.textContent = total;
    statCompleted.textContent = completed;
    statPending.textContent = pending;
  }

  /* ============================================================
     DARK MODE
  ============================================================ */
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    updateThemeToggleUI();
    saveTheme();
  });

  /* ============================================================
     INITIALIZE
  ============================================================ */
  function init() {
    loadTheme();
    loadTasks();
    renderTasks();
    updateStats();
  }

  init();

});