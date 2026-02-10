const socket = io();

const inputContainer = document.getElementById('input-items');
const queuesContainer = document.getElementById('queues-container');
const outputContainer = document.getElementById('output-items');

// State to track active queues
const activeQueues = new Map();

socket.on('connect', () => {
  console.log('Connected to UFBM Stream');
});

socket.on('queue_update', (data) => {
  console.log('Update:', data);
  handleUpdate(data);
});

function handleUpdate(data) {
  const { pageId, status, profilePic, task, error, postId } = data;

  // 1. Ensure Queue Row Exists
  if (!activeQueues.has(pageId)) {
    createQueueRow(pageId, profilePic);
  }
  
  const queueElement = activeQueues.get(pageId);
  const statusElement = queueElement.querySelector('.queue-status-text');
  const badgeElement = queueElement.querySelector('.status-badge');

  // 2. Visual Logic based on Status
  if (status === 'queued') {
    // Add to Input Stream
    addCard(inputContainer, `New Request for Page ${pageId.slice(0, 5)}...`, 'queued');
    
    // Update Queue UI
    statusElement.textContent = `Pending items...`;
    badgeElement.className = 'status-badge idle';
    badgeElement.textContent = 'QUEUED';
  }
  else if (status === 'processing') {
    // Update Queue UI to "Active"
    statusElement.textContent = task || 'Processing...';
    badgeElement.className = 'status-badge processing';
    badgeElement.textContent = 'PROCESSING';
  }
  else if (status === 'completed') {
    // Move to Output
    addCard(outputContainer, `Posted to Page ${pageId.slice(0, 5)}... (ID: ${postId})`, 'completed');
    
    // Reset Queue UI
    statusElement.textContent = 'Waiting for tasks...';
    badgeElement.className = 'status-badge idle';
    badgeElement.textContent = 'IDLE';
  }
  else if (status === 'failed') {
    // Move to Output (Error)
    addCard(outputContainer, `Failed: ${error}`, 'failed');
    
    // Reset Queue UI
    statusElement.textContent = 'Waiting for tasks...';
    badgeElement.className = 'status-badge idle';
    badgeElement.textContent = 'IDLE';
  }
}

function createQueueRow(pageId, profilePic) {
  const row = document.createElement('div');
  row.className = 'queue-row';
  row.id = `queue-${pageId}`;
  
  row.innerHTML = `
    <img src="${profilePic}" alt="Page" onerror="this.src='https://placehold.co/50x50?text=FB'">
    <div class="queue-info">
      <div style="font-weight: bold; margin-bottom: 4px;">Page ID: ${pageId}</div>
      <div class="queue-status-text">Waiting for tasks...</div>
    </div>
    <span class="status-badge idle">IDLE</span>
  `;

  queuesContainer.appendChild(row);
  activeQueues.set(pageId, row);
}

function addCard(container, text, type) {
  const card = document.createElement('div');
  card.className = `item-card ${type}`;
  card.textContent = text;
  
  container.prepend(card); // Add to top

  // Clean up old items if too many
  if (container.children.length > 50) {
    container.lastElementChild.remove();
  }
}
