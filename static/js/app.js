document.addEventListener('DOMContentLoaded', () => {
    // App State
    let releaseNotes = [];
    let parsedUpdates = [];
    let selectedUpdate = null;
    let currentTone = 'technical';
    let simulatedTweets = [];

    // DOM Elements - Header
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshSpinner = document.getElementById('refresh-spinner');
    const refreshIcon = document.getElementById('refresh-icon');
    const lastSyncTime = document.getElementById('last-sync-time');
    const fallbackBadge = document.getElementById('fallback-badge');

    // DOM Elements - Feed
    const notesTimeline = document.getElementById('notes-timeline');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const filterChips = document.querySelectorAll('.filter-chip');

    // DOM Elements - Composer
    const selectionPrompt = document.getElementById('selection-prompt');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const tonePicker = document.getElementById('tone-picker');
    const toneBtns = document.querySelectorAll('.tone-btn');
    const charCountText = document.getElementById('char-count');
    const charProgressCircle = document.getElementById('char-progress');
    const simulateTweetBtn = document.getElementById('simulate-tweet-btn');
    const postXBtn = document.getElementById('post-x-btn');

    // DOM Elements - Preview
    const tweetPreviewText = document.getElementById('tweet-preview-text');
    const tweetPreviewLinkCard = document.getElementById('tweet-preview-link-card');
    const tweetPreviewCardTitle = document.getElementById('tweet-preview-card-title');

    // DOM Elements - Social Feed
    const socialFeedList = document.getElementById('social-feed-list');

    // Circular Progress Settings
    const CIRCUMFERENCE = 2 * Math.PI * 14; // r=14 -> ~87.96
    charProgressCircle.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;
    charProgressCircle.style.strokeDashoffset = CIRCUMFERENCE;

    // Initialize
    fetchReleaseNotes(false);
    fetchSimulatedTweets();

    // Event Listeners - Refresh
    refreshBtn.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });

    // Event Listeners - Search & Filter
    searchInput.addEventListener('input', () => {
        if (searchInput.value.trim().length > 0) {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
        }
        renderUpdatesTimeline();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.add('hidden');
        renderUpdatesTimeline();
        searchInput.focus();
    });

    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            renderUpdatesTimeline();
        });
    });

    // Event Listeners - Composer
    tweetTextarea.addEventListener('input', () => {
        updateComposerUI();
    });

    toneBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toneBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTone = btn.dataset.tone;
            if (selectedUpdate) {
                generateTweetText();
            }
        });
    });

    postXBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        if (!text || text.length > 280) return;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, '_blank');
    });

    simulateTweetBtn.addEventListener('click', () => {
        simulatePostTweet();
    });

    // --- Core Functions ---

    // Fetch release notes from backend
    async function fetchReleaseNotes(forceRefresh = false) {
        setLoadingState(true);
        try {
            const response = await fetch(`/api/release-notes?refresh=${forceRefresh}`);
            if (!response.ok) throw new Error('Failed to fetch release notes');
            const data = await response.json();
            
            releaseNotes = data.notes;
            
            // Format Last Synced time
            const localTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            lastSyncTime.textContent = `Last synced: ${localTimeStr}`;

            if (data.isFallback) {
                fallbackBadge.classList.remove('hidden');
            } else {
                fallbackBadge.classList.add('hidden');
            }

            parseReleaseNotes();
            renderUpdatesTimeline();
        } catch (error) {
            console.error('Error fetching release notes:', error);
            notesTimeline.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--color-issue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <h3>Error Loading Notes</h3>
                    <p>Failed to retrieve release notes from the server. Check your backend status.</p>
                </div>
            `;
        } finally {
            setLoadingState(false);
        }
    }

    // Set loading button and feed animations
    function setLoadingState(isLoading) {
        if (isLoading) {
            refreshSpinner.classList.remove('hidden');
            refreshIcon.classList.add('hidden');
            refreshBtn.disabled = true;
        } else {
            refreshSpinner.classList.add('hidden');
            refreshIcon.classList.remove('hidden');
            refreshBtn.disabled = false;
        }
    }

    // Parse feed entries into individual granular change blocks
    function parseReleaseNotes() {
        parsedUpdates = [];
        
        releaseNotes.forEach((entry, entryIndex) => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = entry.content;
            
            const children = Array.from(tempDiv.children);
            let currentGroup = null;
            let currentHeading = '';
            
            children.forEach((child) => {
                const tag = child.tagName.toLowerCase();
                
                // If it is a heading, start a new group
                if (tag === 'h3' || tag === 'h4') {
                    if (currentGroup) {
                        parsedUpdates.push(currentGroup);
                    }
                    currentHeading = child.textContent.trim();
                    currentGroup = {
                        id: `${entry.id}_group_${parsedUpdates.length}`,
                        date: entry.formatted_date,
                        rawDate: entry.updated,
                        title: entry.title,
                        category: currentHeading.toLowerCase(),
                        categoryLabel: currentHeading,
                        bodyHtml: '',
                        link: entry.link,
                        elements: []
                    };
                } else if (currentGroup) {
                    // Accumulate contents for the current group
                    currentGroup.elements.push(child.outerHTML);
                }
            });
            
            // Push final group
            if (currentGroup) {
                parsedUpdates.push(currentGroup);
            }
            
            // If no headings were found in the entry, import the entire content block as a single entity
            if (children.length > 0 && parsedUpdates.filter(u => u.id.startsWith(entry.id)).length === 0) {
                parsedUpdates.push({
                    id: `${entry.id}_default`,
                    date: entry.formatted_date,
                    rawDate: entry.updated,
                    title: entry.title,
                    category: 'announcement', // default
                    categoryLabel: 'Announcement',
                    bodyHtml: entry.content,
                    link: entry.link,
                    elements: [entry.content]
                });
            }
        });

        // Assemble the HTML contents for all parsed updates
        parsedUpdates.forEach(update => {
            update.bodyHtml = update.elements.join('\n');
            // Extract a clean text version for search/summaries
            const parser = new DOMParser();
            const parsedDoc = parser.parseFromString(update.bodyHtml, 'text/html');
            update.textSummary = parsedDoc.body.textContent || parsedDoc.body.innerText || '';
        });
    }

    // Render timeline feed of release notes
    function renderUpdatesTimeline() {
        const searchQuery = searchInput.value.trim().toLowerCase();
        const activeCategoryChip = document.querySelector('.filter-chip.active');
        const activeCategory = activeCategoryChip ? activeCategoryChip.dataset.category : 'all';

        notesTimeline.innerHTML = '';

        // Filter updates
        const filtered = parsedUpdates.filter(update => {
            // Category Filter match
            let categoryMatch = false;
            if (activeCategory === 'all') {
                categoryMatch = true;
            } else if (activeCategory === 'feature' && update.category.includes('feature')) {
                categoryMatch = true;
            } else if (activeCategory === 'announcement' && (update.category.includes('announcement') || update.category.includes('deprecation'))) {
                categoryMatch = true;
            } else if (activeCategory === 'issue' && (update.category.includes('issue') || update.category.includes('fix') || update.category.includes('known issue'))) {
                categoryMatch = true;
            }

            // Search filter match
            let searchMatch = true;
            if (searchQuery) {
                const titleText = update.title.toLowerCase();
                const contentText = update.textSummary.toLowerCase();
                const catText = update.categoryLabel.toLowerCase();
                searchMatch = titleText.includes(searchQuery) || contentText.includes(searchQuery) || catText.includes(searchQuery);
            }

            return categoryMatch && searchMatch;
        });

        if (filtered.length === 0) {
            notesTimeline.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <h3>No updates found</h3>
                    <p>Try clearing your search query or toggling filters.</p>
                </div>
            `;
            return;
        }

        // Group updates by date for presentation
        const groupedByDate = {};
        filtered.forEach(update => {
            if (!groupedByDate[update.date]) {
                groupedByDate[update.date] = [];
            }
            groupedByDate[update.date].push(update);
        });

        // Render groups
        for (const date in groupedByDate) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'notes-group';
            
            const groupHeader = document.createElement('div');
            groupHeader.className = 'notes-date-title';
            groupHeader.textContent = date;
            groupDiv.appendChild(groupHeader);

            groupedByDate[date].forEach(update => {
                const itemDiv = document.createElement('div');
                itemDiv.className = `update-item ${selectedUpdate && selectedUpdate.id === update.id ? 'selected' : ''}`;
                itemDiv.dataset.id = update.id;
                
                // Add categories classes to style badges
                let badgeClass = 'announcement';
                if (update.category.includes('feature')) badgeClass = 'feature';
                else if (update.category.includes('issue') || update.category.includes('fix')) badgeClass = 'issue';
                else if (update.category.includes('deprecation')) badgeClass = 'deprecation';

                itemDiv.innerHTML = `
                    <div class="update-header">
                        <span class="update-type-badge ${badgeClass}">${update.categoryLabel}</span>
                    </div>
                    <div class="update-content">
                        ${update.bodyHtml}
                    </div>
                    <div class="update-footer">
                        <button class="btn-share-inline" aria-label="Share this update">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                            </svg>
                            <span>Share</span>
                        </button>
                    </div>
                `;

                // Item Click selects update
                itemDiv.addEventListener('click', (e) => {
                    // Prevent link clicks within content from overriding selection
                    if (e.target.tagName.toLowerCase() === 'a') return;
                    
                    selectUpdateCard(update);
                });

                groupDiv.appendChild(itemDiv);
            });

            notesTimeline.appendChild(groupDiv);
        }
    }

    // Handle card selection
    function selectUpdateCard(update) {
        selectedUpdate = update;
        
        // Update timeline selection style
        document.querySelectorAll('.update-item').forEach(card => {
            if (card.dataset.id === update.id) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        // Hide selection instructions prompt
        selectionPrompt.classList.add('hidden');

        // Regenerate text
        generateTweetText();
    }

    // Generate suggested tweet text from current update details and chosen tone
    function generateTweetText() {
        if (!selectedUpdate) return;

        // Clean up content summaries to prevent overflow HTML
        let cleanText = selectedUpdate.textSummary.trim();
        
        // Shorten long statements
        if (cleanText.length > 180) {
            cleanText = cleanText.substring(0, 175) + '...';
        }

        const date = selectedUpdate.date;
        const category = selectedUpdate.categoryLabel;
        const link = selectedUpdate.link;

        let tweet = '';

        switch(currentTone) {
            case 'excited':
                tweet = `🚀 New BigQuery ${category} announced! (${date})\n\n"${cleanText}"\n\nRead details here: ${link} #BigQuery #GoogleCloud`;
                break;
            case 'punchy':
                tweet = `New in BigQuery: ${cleanText} \n\nCheck out the release notes: ${link} #BigQuery`;
                break;
            case 'formal':
                tweet = `Google Cloud has published a release update regarding BigQuery (${category} - ${date}):\n\n"${cleanText}"\n\nDocumentation: ${link} #BigQuery #GCP`;
                break;
            case 'technical':
            default:
                tweet = `[${category}] BigQuery Update (${date}):\n${cleanText}\n\nRef: ${link} #BigQuery #GoogleCloud`;
                break;
        }

        // Clip to 280 to be safe
        if (tweet.length > 280) {
            tweet = tweet.substring(0, 277) + '...';
        }

        tweetTextarea.value = tweet;
        updateComposerUI();
    }

    // Sync composer character tracking, status indicator circles, and live display
    function updateComposerUI() {
        const text = tweetTextarea.value;
        const length = text.length;
        const remaining = 280 - length;

        // Update Text Counter
        charCountText.textContent = remaining;
        
        // Counter thresholds
        charCountText.className = '';
        if (remaining <= 40 && remaining > 0) {
            charCountText.classList.add('warning');
        } else if (remaining <= 0) {
            charCountText.classList.add('danger');
        }

        // Circular Loader progress update
        const progress = Math.min(length / 280, 1);
        const offset = CIRCUMFERENCE - (progress * CIRCUMFERENCE);
        charProgressCircle.style.strokeDashoffset = offset;

        // Circle stroke indicator color updates
        if (length >= 280) {
            charProgressCircle.style.stroke = 'var(--color-issue)';
        } else if (length >= 240) {
            charProgressCircle.style.stroke = 'var(--color-deprecation)';
        } else {
            charProgressCircle.style.stroke = 'var(--primary-color)';
        }

        // Button disables
        const canPost = length > 0 && length <= 280;
        simulateTweetBtn.disabled = !canPost;
        postXBtn.disabled = !canPost;

        // Live Twitter Card preview update
        if (length === 0) {
            tweetPreviewText.innerHTML = '<span class="text-muted">Select a release note or start typing to preview your post...</span>';
            tweetPreviewLinkCard.classList.add('hidden');
        } else {
            // Basic regex formatting for tags, handles and urls to look nice in the preview
            let previewHtml = text
                .replace(/(#[a-zA-Z0-9_]+)/g, '<span style="color: #1d9bf0;">$1</span>')
                .replace(/(@[a-zA-Z0-9_]+)/g, '<span style="color: #1d9bf0;">$1</span>')
                .replace(/(https?:\/\/[^\s]+)/g, '<span style="color: #1d9bf0; word-break: break-all;">$1</span>');
                
            tweetPreviewText.innerHTML = previewHtml;

            // Link Card Presentation
            if (selectedUpdate) {
                tweetPreviewLinkCard.classList.remove('hidden');
                tweetPreviewCardTitle.textContent = `BigQuery Release Note - ${selectedUpdate.date}`;
            } else {
                tweetPreviewLinkCard.classList.add('hidden');
            }
        }
    }

    // Fetch simulated tweets from backend
    async function fetchSimulatedTweets() {
        try {
            const response = await fetch('/api/tweets');
            if (!response.ok) throw new Error('Failed to retrieve simulated feed');
            simulatedTweets = await response.json();
            renderSimulatedFeed();
        } catch (error) {
            console.error('Error fetching simulated tweets:', error);
        }
    }

    // Post new simulated tweet to backend
    async function simulatePostTweet() {
        const text = tweetTextarea.value;
        if (!text || text.length > 280) return;

        simulateTweetBtn.disabled = true;

        try {
            const response = await fetch('/api/tweets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    author_name: "Google Cloud Tracker",
                    author_handle: "GCPReleaseNotes"
                })
            });

            if (!response.ok) throw new Error('Failed to post simulated tweet');
            
            // Retrieve latest feed
            await fetchSimulatedTweets();
            
            // Optional: reset editor selection slightly or clear text
            tweetTextarea.value = '';
            selectedUpdate = null;
            document.querySelectorAll('.update-item').forEach(c => c.classList.remove('selected'));
            selectionPrompt.classList.remove('hidden');
            updateComposerUI();

            // Slide view header back
            socialFeedList.scrollTop = 0;
        } catch (error) {
            console.error('Error simulating tweet post:', error);
            alert('Failed to simulate tweet. See console for details.');
        } finally {
            simulateTweetBtn.disabled = false;
        }
    }

    // Render simulated tweets in feed list
    function renderSimulatedFeed() {
        socialFeedList.innerHTML = '';
        
        if (simulatedTweets.length === 0) {
            socialFeedList.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    No tweets posted yet. Write one above and click "Simulate"!
                </div>
            `;
            return;
        }

        simulatedTweets.forEach(tweet => {
            const tweetDiv = document.createElement('div');
            tweetDiv.className = 'sim-tweet';
            tweetDiv.dataset.id = tweet.id;

            // Simple relative datetime formatting
            const tweetDate = new Date(tweet.date);
            const timeDiff = Math.floor((new Date() - tweetDate) / 1000); // in seconds
            let timeStr = 'Just now';
            if (timeDiff >= 86400) {
                timeStr = tweetDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
            } else if (timeDiff >= 3600) {
                timeStr = `${Math.floor(timeDiff / 3600)}h`;
            } else if (timeDiff >= 60) {
                timeStr = `${Math.floor(timeDiff / 60)}m`;
            }

            // Body HTML with tweet text highlights
            let tweetBodyHtml = tweet.text
                .replace(/(#[a-zA-Z0-9_]+)/g, '<span style="color: #1d9bf0;">$1</span>')
                .replace(/(@[a-zA-Z0-9_]+)/g, '<span style="color: #1d9bf0;">$1</span>')
                .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: #1d9bf0; text-decoration: none;">$1</a>');

            tweetDiv.innerHTML = `
                <div class="sim-tweet-header">
                    <div class="sim-avatar">BQ</div>
                    <span class="sim-user-name">${tweet.author_name}</span>
                    <span class="sim-user-handle">@${tweet.author_handle}</span>
                    <span class="sim-time">${timeStr}</span>
                </div>
                <div class="sim-tweet-body">
                    ${tweetBodyHtml}
                </div>
                <div class="sim-tweet-actions">
                    <button class="sim-action-btn btn-retweet" aria-label="Retweet">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19.683 5.682c.07.297.18.614.282.951m-11.896-.177c-.138-.365-.33-.745-.556-1.124a15.352 15.352 0 00-2.899-3.722L3 3.003l3.555 1.15c.725.234 1.407.586 2.029 1.04m0 0a15.35 15.35 0 012.898 3.722c.756 1.253 1.218 2.64 1.371 4.088m1.23-7.308a15.35 15.35 0 011.022 3.978c.024.16.039.321.045.482m-8.479 2.274l2.122-.765m-.002 0a15.39 15.39 0 00-.73 2.739M1.05 11l.008.134M5 19l4.555-1.15a15.3 15.3 0 00-2.03-1.04m0 0A15.33 15.33 0 014.63 13.09c-.756-1.253-1.218-2.64-1.371-4.088m-1.23 7.308a15.35 15.35 0 01-1.022-3.978M5.523 16.046l-2.122.765m0 0a15.39 15.39 0 00.73-2.739" />
                        </svg>
                        <span class="count">${tweet.retweets}</span>
                    </button>
                    <button class="sim-action-btn btn-like" aria-label="Like">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <span class="count">${tweet.likes}</span>
                    </button>
                </div>
            `;

            // Like action handler
            const likeBtn = tweetDiv.querySelector('.btn-like');
            likeBtn.addEventListener('click', async () => {
                if (likeBtn.classList.contains('liked')) return; // Allow single likes for simplicity
                likeBtn.classList.add('liked');
                try {
                    const res = await fetch(`/api/tweets/${tweet.id}/like`, { method: 'POST' });
                    const updated = await res.json();
                    likeBtn.querySelector('.count').textContent = updated.likes;
                } catch (err) {
                    console.error(err);
                }
            });

            // Retweet action handler
            const retweetBtn = tweetDiv.querySelector('.btn-retweet');
            retweetBtn.addEventListener('click', async () => {
                if (retweetBtn.classList.contains('retweeted')) return;
                retweetBtn.classList.add('retweeted');
                try {
                    const res = await fetch(`/api/tweets/${tweet.id}/retweet`, { method: 'POST' });
                    const updated = await res.json();
                    retweetBtn.querySelector('.count').textContent = updated.retweets;
                } catch (err) {
                    console.error(err);
                }
            });

            socialFeedList.appendChild(tweetDiv);
        });
    }
});
