// Application State
let state = {
    releases: [],
    filteredReleases: [],
    currentFilter: 'all',
    currentSearch: '',
    currentSort: 'newest',
    selectedRelease: null,
    currentTemplateType: 'default'
};

// DOM Elements
const DOM = {
    releasesContainer: document.getElementById('releases-container'),
    btnRefresh: document.getElementById('btn-refresh'),
    spinnerIcon: document.querySelector('.spinner-icon'),
    syncText: document.getElementById('sync-text'),
    lastUpdated: document.getElementById('last-updated'),
    searchInput: document.getElementById('search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    filterChips: document.getElementById('filter-chips'),
    sortSelect: document.getElementById('sort-select'),
    statusBanner: document.getElementById('status-banner'),
    bannerMessage: document.getElementById('banner-message'),
    btnBannerClose: document.getElementById('btn-banner-close'),
    
    // Theme toggle
    themeToggle: document.getElementById('theme-toggle'),
    iconSun: document.querySelector('.icon-sun'),
    iconMoon: document.querySelector('.icon-moon'),
    
    // CSV Export
    btnExportCsv: document.getElementById('btn-export-csv'),
    
    // Modal Elements
    tweetModal: document.getElementById('tweet-modal'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    tweetCharCount: document.getElementById('tweet-char-count'),
    tweetProgressBar: document.getElementById('tweet-progress-bar'),
    mockTweetContent: document.getElementById('mock-tweet-content'),
    mockCardTitle: document.getElementById('mock-card-title'),
    mockCardPreview: document.getElementById('mock-card-preview'),
    btnCancel: document.getElementById('btn-cancel'),
    btnTweetSubmit: document.getElementById('btn-tweet'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    templateChips: document.querySelectorAll('.btn-template'),
    
    // Chip counts
    counts: {
        all: document.getElementById('count-all'),
        Feature: document.getElementById('count-feature'),
        Change: document.getElementById('count-change'),
        Deprecated: document.getElementById('count-deprecated'),
        Fixed: document.getElementById('count-fixed'),
        General: document.getElementById('count-general')
    }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupEventListeners();
    fetchReleases(false); // Initial load uses cache
});

// Set up DOM Event Listeners
function setupEventListeners() {
    // Refresh action
    DOM.btnRefresh.addEventListener('click', () => fetchReleases(true));
    
    // Search action
    DOM.searchInput.addEventListener('input', (e) => {
        state.currentSearch = e.target.value.toLowerCase().trim();
        DOM.btnClearSearch.style.display = state.currentSearch ? 'block' : 'none';
        applyFiltersAndSort();
    });
    
    DOM.btnClearSearch.addEventListener('click', () => {
        DOM.searchInput.value = '';
        state.currentSearch = '';
        DOM.btnClearSearch.style.display = 'none';
        DOM.searchInput.focus();
        applyFiltersAndSort();
    });
    
    // Filter chip actions
    DOM.filterChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        
        // Remove active class from all chips
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        
        // Add active class to selected chip
        chip.classList.add('active');
        
        state.currentFilter = chip.dataset.type;
        applyFiltersAndSort();
    });
    
    // Sort select action
    DOM.sortSelect.addEventListener('change', (e) => {
        state.currentSort = e.target.value;
        applyFiltersAndSort();
    });
    
    // Export CSV action
    DOM.btnExportCsv.addEventListener('click', exportToCsv);
    
    // Theme toggle action
    DOM.themeToggle.addEventListener('click', toggleTheme);
    
    // Banner close action
    DOM.btnBannerClose.addEventListener('click', hideBanner);
    
    // Modal actions
    DOM.btnCloseModal.addEventListener('click', closeTweetModal);
    DOM.btnCancel.addEventListener('click', closeTweetModal);
    DOM.tweetTextarea.addEventListener('input', handleTweetTextChange);
    DOM.btnTweetSubmit.addEventListener('click', submitTweet);
    
    // Template chips actions
    DOM.templateChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            DOM.templateChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.currentTemplateType = chip.dataset.template;
            applyTemplate(state.currentTemplateType);
        });
    });
    
    // Close modal on clicking outside overlay
    DOM.tweetModal.addEventListener('click', (e) => {
        if (e.target === DOM.tweetModal) {
            closeTweetModal();
        }
    });

    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && DOM.tweetModal.classList.contains('show')) {
            closeTweetModal();
        }
    });
}

// Fetch Releases from Backend API
async function fetchReleases(forceRefresh = false) {
    setLoadingState(true);
    hideBanner();
    
    try {
        const url = `/api/releases?refresh=${forceRefresh}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            state.releases = data.releases;
            
            // Set update timestamp
            if (data.last_fetched) {
                const date = new Date(data.last_fetched);
                DOM.lastUpdated.textContent = `Last sync: ${date.toLocaleTimeString()}`;
            }
            
            // If data is served from stale cache due to internet/fetch error
            if (data.error && data.cached) {
                showBanner('Offline mode: Could not fetch latest updates. Displaying cached data.');
            }
            
            updateChipCounts();
            applyFiltersAndSort();
        } else {
            showBanner('Error loading release notes. Please check your internet connection or try again later.');
            renderEmptyState('Failed to Load Releases', 'We encountered an error trying to pull the release notes from Google Cloud. Please try refreshing.');
        }
    } catch (error) {
        console.error('Fetch error:', error);
        showBanner('Network error: Could not reach the server.');
        renderEmptyState('Network Error', 'The server could not be reached. Make sure your Flask application is running.');
    } finally {
        setLoadingState(false);
    }
}

// Update UI Spinner and Button states
function setLoadingState(isLoading) {
    if (isLoading) {
        DOM.spinnerIcon.classList.add('spinning');
        DOM.btnRefresh.disabled = true;
        DOM.syncText.textContent = 'Syncing...';
        DOM.syncText.classList.remove('online');
        DOM.syncText.classList.add('syncing');
        
        // Show skeleton screens if no releases are currently loaded
        if (state.releases.length === 0) {
            DOM.releasesContainer.innerHTML = Array(3).fill(0).map(() => `
                <div class="skeleton-card">
                    <div class="skeleton-header">
                        <div class="skeleton-badge"></div>
                        <div class="skeleton-date"></div>
                    </div>
                    <div class="skeleton-body">
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line short"></div>
                    </div>
                    <div class="skeleton-footer"></div>
                </div>
            `).join('');
        }
    } else {
        DOM.spinnerIcon.classList.remove('spinning');
        DOM.btnRefresh.disabled = false;
        DOM.syncText.textContent = 'Status: Active';
        DOM.syncText.classList.remove('syncing');
        DOM.syncText.classList.add('online');
    }
}

// Calculate and show counts on chips
function updateChipCounts() {
    const total = state.releases.length;
    DOM.counts.all.textContent = total;
    
    // Initialize standard categories
    const counts = {
        Feature: 0,
        Change: 0,
        Deprecated: 0,
        Fixed: 0,
        General: 0
    };
    
    state.releases.forEach(rel => {
        const type = rel.type || 'General';
        if (counts.hasOwnProperty(type)) {
            counts[type]++;
        } else {
            counts.General++;
        }
    });
    
    // Update labels
    Object.keys(counts).forEach(key => {
        if (DOM.counts[key]) {
            DOM.counts[key].textContent = counts[key];
        }
    });
}

// Apply Active Filters (search + chip) and Sort Order
function applyFiltersAndSort() {
    let result = [...state.releases];
    
    // 1. Apply Type Filter
    if (state.currentFilter !== 'all') {
        result = result.filter(rel => (rel.type || 'General') === state.currentFilter);
    }
    
    // 2. Apply Text Search
    if (state.currentSearch) {
        result = result.filter(rel => {
            const dateMatch = rel.date.toLowerCase().includes(state.currentSearch);
            const typeMatch = rel.type.toLowerCase().includes(state.currentSearch);
            const contentMatch = rel.content_text.toLowerCase().includes(state.currentSearch);
            return dateMatch || typeMatch || contentMatch;
        });
    }
    
    // 3. Apply Sorting
    result.sort((a, b) => {
        const dateA = new Date(a.iso_date);
        const dateB = new Date(b.iso_date);
        
        return state.currentSort === 'newest' ? dateB - dateA : dateA - dateB;
    });
    
    state.filteredReleases = result;
    renderReleases();
}

// Render Release Cards inside main container
function renderReleases() {
    if (state.filteredReleases.length === 0) {
        renderEmptyState('No updates match your criteria', 'Try clearing your search query or choosing a different filter chip.');
        return;
    }
    
    DOM.releasesContainer.innerHTML = '';
    
    state.filteredReleases.forEach(rel => {
        const card = document.createElement('article');
        card.className = 'release-card';
        
        // Map types to corresponding class styles
        const typeClass = `badge-${(rel.type || 'General').toLowerCase()}`;
        const typeLabel = rel.type || 'General';
        
        // Define color accent inline variable
        let accentColor = 'var(--color-general)';
        if (rel.type === 'Feature') accentColor = 'var(--color-feature)';
        else if (rel.type === 'Change') accentColor = 'var(--color-change)';
        else if (rel.type === 'Deprecated') accentColor = 'var(--color-deprecated)';
        else if (rel.type === 'Fixed') accentColor = 'var(--color-fixed)';
        
        card.style.setProperty('--badge-color', accentColor);
        
        card.innerHTML = `
            <div class="release-card-header">
                <div class="release-badge-date">
                    <span class="badge ${typeClass}">${typeLabel}</span>
                    <span class="release-date">${rel.date}</span>
                </div>
                <a href="${rel.link}" target="_blank" rel="noopener noreferrer" class="release-source-link" title="Open official release notes page">
                    <svg viewBox="0 0 24 24" width="18" height="18">
                        <path fill="currentColor" d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
                    </svg>
                </a>
            </div>
            
            <div class="release-card-body">
                ${rel.content_html}
            </div>
            
            <div class="release-card-footer">
                <button class="btn btn-secondary btn-copy" data-id="${rel.id}">
                    <svg viewBox="0 0 24 24" width="12" height="12" style="margin-right: 4px; vertical-align: middle;">
                        <path fill="currentColor" d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/>
                    </svg>
                    <span class="btn-copy-text">Copy</span>
                </button>
                <button class="btn btn-tweet-share" data-id="${rel.id}">
                    <svg viewBox="0 0 24 24" width="14" height="14">
                        <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <span>Share on X</span>
                </button>
            </div>
        `;
        
        // Add event listener to copy button
        card.querySelector('.btn-copy').addEventListener('click', (e) => {
            copyReleaseToClipboard(rel, e.currentTarget);
        });
        
        // Add event listener to share button
        card.querySelector('.btn-tweet-share').addEventListener('click', () => {
            openTweetModal(rel);
        });
        
        DOM.releasesContainer.appendChild(card);
    });
}

// Render empty search or load results warning
function renderEmptyState(title, subtitle) {
    DOM.releasesContainer.innerHTML = `
        <div class="empty-state">
            <span class="empty-icon">📂</span>
            <h3>${title}</h3>
            <p>${subtitle}</p>
        </div>
    `;
}

// Show Alert Banner
function showBanner(message) {
    DOM.bannerMessage.textContent = message;
    DOM.statusBanner.classList.remove('hidden');
}

// Hide Alert Banner
function hideBanner() {
    DOM.statusBanner.classList.add('hidden');
}

/* ==========================================
   TWITTER SHARE MODAL LOGIC
========================================== */

function openTweetModal(release) {
    state.selectedRelease = release;
    
    // Set standard properties on mock preview card
    DOM.mockCardTitle.textContent = `BigQuery Release notes - ${release.date}`;
    DOM.mockCardPreview.onclick = () => window.open(release.link, '_blank');
    
    // Reset Template Chip selection
    DOM.templateChips.forEach(c => c.classList.remove('active'));
    document.querySelector('[data-template="default"]').classList.add('active');
    state.currentTemplateType = 'default';
    
    // Set text contents
    applyTemplate('default');
    
    // Show Modal
    DOM.tweetModal.classList.add('show');
    DOM.tweetTextarea.focus();
}

function closeTweetModal() {
    DOM.tweetModal.classList.remove('show');
    state.selectedRelease = null;
}

// Construct and apply selected tweet text template
function applyTemplate(templateType) {
    if (!state.selectedRelease) return;
    
    const rel = state.selectedRelease;
    const typeLabel = rel.type || 'General';
    const dateStr = rel.date;
    
    // Generate clean text snippet (max 120 chars to fit within 280 chars)
    let snippet = rel.content_text;
    if (snippet.length > 130) {
        snippet = snippet.substring(0, 127) + '...';
    }
    
    let text = '';
    
    switch (templateType) {
        case 'feature':
            text = `🚀 New #BigQuery Update (${dateStr})!\n\n${typeLabel}: ${snippet}\n\nRead more details here:\n${rel.link} #GoogleCloud #DataEngineering`;
            break;
            
        case 'short':
            text = `⚡ #BigQuery Update: [${typeLabel}] ${snippet}\nLink: ${rel.link}`;
            break;
            
        case 'default':
        default:
            text = `🔍 Google BigQuery Release Update (${dateStr})\n\nType: ${typeLabel}\n\n${snippet}\n\nOfficial Docs:\n${rel.link} #BigQuery`;
            break;
    }
    
    DOM.tweetTextarea.value = text;
    handleTweetTextChange();
}

// Keep preview, char count, progress bar in sync with textarea
function handleTweetTextChange() {
    const text = DOM.tweetTextarea.value;
    const length = text.length;
    
    // X/Twitter limit is 280 characters
    DOM.tweetCharCount.textContent = `${length} / 280`;
    
    // Calculate percentage width for progress indicator
    const percentage = Math.min((length / 280) * 100, 100);
    DOM.tweetProgressBar.style.width = `${percentage}%`;
    
    // Color states for warnings
    DOM.tweetCharCount.classList.remove('warning', 'danger');
    DOM.tweetProgressBar.classList.remove('warning', 'danger');
    
    if (length >= 260 && length <= 280) {
        DOM.tweetCharCount.classList.add('warning');
        DOM.tweetProgressBar.classList.add('warning');
    } else if (length > 280) {
        DOM.tweetCharCount.classList.add('danger');
        DOM.tweetProgressBar.classList.add('danger');
    }
    
    // Disable submit button if empty or over character limit
    DOM.btnTweetSubmit.disabled = length === 0 || length > 280;
    
    // Live update X mockup content
    // Replace URL strings with clickable lookalikes for high fidelity preview
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    let formattedText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(urlPattern, '<span class="mock-link">$1</span>')
        .replace(/#(\w+)/g, '<span class="mock-link">#$1</span>')
        .replace(/@(\w+)/g, '<span class="mock-link">@$1</span>');
        
    DOM.mockTweetContent.innerHTML = formattedText;
}

// Launch the X/Twitter Share Web Intent URL in new tab
function submitTweet() {
    const text = DOM.tweetTextarea.value;
    if (text.length === 0 || text.length > 280) return;
    
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(intentUrl, '_blank', 'width=550,height=420,referrerpolicy=no-referrer');
    
    closeTweetModal();
}

/* ==========================================
   THEME AND UTILITY FUNCTIONS
========================================== */

// Initialize Light/Dark Theme from LocalStorage
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        DOM.iconSun.style.display = 'block';
        DOM.iconMoon.style.display = 'none';
    } else {
        document.body.classList.remove('light-theme');
        DOM.iconSun.style.display = 'none';
        DOM.iconMoon.style.display = 'block';
    }
}

// Toggle Light/Dark Theme
function toggleTheme() {
    const isLightTheme = document.body.classList.toggle('light-theme');
    if (isLightTheme) {
        localStorage.setItem('theme', 'light');
        DOM.iconSun.style.display = 'block';
        DOM.iconMoon.style.display = 'none';
    } else {
        localStorage.setItem('theme', 'dark');
        DOM.iconSun.style.display = 'none';
        DOM.iconMoon.style.display = 'block';
    }
}

// Copy a Release update text to Clipboard
function copyReleaseToClipboard(release, buttonEl) {
    const dateStr = release.date;
    const typeStr = release.type || 'General';
    const cleanText = release.content_text;
    const linkStr = release.link;
    
    // Format copied text nicely
    const textToCopy = `Google BigQuery Release - ${dateStr}\nType: ${typeStr}\n\n${cleanText}\n\nOfficial Link: ${linkStr}`;
    
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            // Update button visual state
            buttonEl.classList.add('copied');
            const textSpan = buttonEl.querySelector('.btn-copy-text');
            const origHtml = buttonEl.innerHTML;
            
            buttonEl.innerHTML = `
                <svg viewBox="0 0 24 24" width="12" height="12" style="margin-right: 4px; vertical-align: middle;">
                    <path fill="currentColor" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>
                </svg>
                <span class="btn-copy-text">Copied!</span>
            `;
            
            setTimeout(() => {
                buttonEl.classList.remove('copied');
                buttonEl.innerHTML = origHtml;
            }, 2000);
        })
        .catch(err => {
            console.error('Failed to copy text:', err);
            showBanner('Could not copy to clipboard. Please select and copy manually.');
        });
}

// Export currently filtered and sorted releases to CSV
function exportToCsv() {
    if (state.filteredReleases.length === 0) {
        showBanner('No release notes available to export.');
        return;
    }
    
    const headers = ['Date', 'Type', 'Content Text', 'Source Link'];
    
    // Helper to wrap fields in quotes and escape internal quotes
    const escapeCsvField = (text) => {
        if (text === null || text === undefined) return '""';
        const str = String(text).replace(/"/g, '""'); // Escape quotes
        return `"${str}"`;
    };
    
    const rows = state.filteredReleases.map(rel => [
        escapeCsvField(rel.date),
        escapeCsvField(rel.type || 'General'),
        escapeCsvField(rel.content_text),
        escapeCsvField(rel.link)
    ]);
    
    // Compile CSV Content
    const csvContent = [
        headers.map(escapeCsvField).join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');
    
    try {
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel compatibility
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.setAttribute('href', url);
        
        // Name file based on active filter
        const filterName = state.currentFilter === 'all' ? 'all' : state.currentFilter.toLowerCase();
        const filename = `bigquery_releases_${filterName}_${new Date().toISOString().slice(0, 10)}.csv`;
        
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Error generating CSV:', err);
        showBanner('Failed to export CSV file.');
    }
}
