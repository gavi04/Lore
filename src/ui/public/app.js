document.addEventListener('DOMContentLoaded', () => {
    // --- Security ---
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // --- Navigation ---
    const navLinks = document.querySelectorAll('.nav-links a');
    const views = document.querySelectorAll('.view');

    function showView(targetId) {
        navLinks.forEach(l => l.classList.remove('active'));
        document.querySelector(`[data-target="${targetId}"]`).classList.add('active');

        views.forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${targetId}`).classList.add('active');

        if (targetId === 'graph') {
            loadGraph();
        }
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showView(e.target.dataset.target);
        });
    });

    // --- Toast Notifications ---
    function showToast(msg) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }

    // --- Data Loading ---
    async function loadStats() {
        try {
            const res = await fetch('/api/stats');
            const data = await res.json();

            // Dashboard
            document.getElementById('score-value').textContent = data.score.score;
            document.getElementById('stat-coverage').textContent = `${data.score.coverage}%`;
            document.getElementById('fill-coverage').style.width = `${data.score.coverage}%`;
            document.getElementById('stat-freshness').textContent = `${data.score.freshness}%`;
            document.getElementById('fill-freshness').style.width = `${data.score.freshness}%`;
            document.getElementById('stat-depth').textContent = `${data.score.depth}%`;
            document.getElementById('fill-depth').style.width = `${data.score.depth}%`;

            // Tips
            const tipsUl = document.getElementById('score-tips');
            tipsUl.innerHTML = '';
            if (data.score.topUnlogged && data.score.topUnlogged.length > 0) {
                const top = data.score.topUnlogged[0];
                const li = document.createElement('li');
                li.textContent = `CRITICAL: Unlogged high-activity module [${top.module}] (${top.commits} commits)`;
                tipsUl.appendChild(li);
            } else {
                tipsUl.innerHTML = '<li>System nominal. All core modules documented.</li>';
            }

            // Nav Badge
            document.getElementById('nav-draft-count').textContent = data.draftCount;

        } catch (e) {
            console.error('Failed to load stats', e);
        }
    }

    let allEntries = [];

    async function loadEntries() {
        try {
            const res = await fetch('/api/entries');
            allEntries = await res.json();
            renderEntries(allEntries);
        } catch (e) {
            console.error('Failed to load entries', e);
        }
    }

    function renderEntries(entries) {
        const container = document.getElementById('kb-list');
        container.innerHTML = '';

        if (entries.length === 0) {
            container.innerHTML = '<p class="muted">No knowledge entries found in memory banks.</p>';
            return;
        }

        entries.forEach(entry => {
            const card = document.createElement('div');
            card.className = 'entry-card';

            const badgeClass = `type-${entry.type.toLowerCase()}`;

            let filesHtml = '';
            if (entry.files && entry.files.length > 0) {
                filesHtml = `<div class="entry-meta">Files: ${escapeHtml(entry.files.join(', '))}</div>`;
            }

            let tagsHtml = '';
            if (entry.tags && entry.tags.length > 0) {
                tagsHtml = `<div class="entry-meta">Tags: ${escapeHtml(entry.tags.join(', '))}</div>`;
            }

            card.innerHTML = `
                <div class="entry-header">
                    <span class="type-badge ${escapeHtml(badgeClass)}">[${escapeHtml(entry.type).toUpperCase()}]</span>
                    <span class="entry-date muted">${escapeHtml(entry.date.split('T')[0])}</span>
                </div>
                <div class="entry-title">${escapeHtml(entry.title)}</div>
                <div class="entry-context">${escapeHtml(entry.context)}</div>
                ${filesHtml}
                ${tagsHtml}
            `;
            container.appendChild(card);
        });
    }

    // Knowledge Base Filter & Search
    document.getElementById('kb-search').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const typeMode = document.getElementById('kb-filter').value;
        const filtered = allEntries.filter(e => {
            const matchQuery = e.title.toLowerCase().includes(query) || e.context.toLowerCase().includes(query);
            const matchType = typeMode === 'all' || e.type === typeMode;
            return matchQuery && matchType;
        });
        renderEntries(filtered);
    });

    document.getElementById('kb-filter').addEventListener('change', (e) => {
        const typeMode = e.target.value;
        const query = document.getElementById('kb-search').value.toLowerCase();
        const filtered = allEntries.filter(e => {
            const matchQuery = e.title.toLowerCase().includes(query) || e.context.toLowerCase().includes(query);
            const matchType = typeMode === 'all' || e.type === typeMode;
            return matchQuery && matchType;
        });
        renderEntries(filtered);
    });

    // Drafts
    async function loadDrafts() {
        try {
            const res = await fetch('/api/drafts');
            const drafts = await res.json();

            const container = document.getElementById('drafts-list');
            container.innerHTML = '';

            if (drafts.length === 0) {
                container.innerHTML = '<p class="muted">All drafts have been processed.</p>';
                return;
            }

            drafts.forEach(draft => {
                const confPercent = Math.round((draft.confidence || 0) * 100);
                const card = document.createElement('div');
                card.className = 'entry-card';
                card.id = `draft-${draft.draftId}`;

                const badgeClass = `type-${draft.suggestedType.toLowerCase()}`;

                let filesHtml = '';
                if (draft.files && draft.files.length > 0) {
                    filesHtml = `<div class="entry-meta">Linked File: ${escapeHtml(draft.files[0])}</div>`;
                }

                card.innerHTML = `
                    <div class="entry-header">
                        <span class="type-badge ${escapeHtml(badgeClass)}">SUGGESTED: [${escapeHtml(draft.suggestedType).toUpperCase()}]</span>
                        <span class="entry-date muted">Confidence: ${confPercent}%</span>
                    </div>
                    <div class="entry-title">${escapeHtml(draft.suggestedTitle)}</div>
                    <div class="entry-context">Evidence: ${escapeHtml(draft.evidence)}</div>
                    ${filesHtml}
                    <div class="draft-actions">
                        <button class="btn btn-accept" onclick="acceptDraft('${escapeHtml(draft.draftId)}')">Accept</button>
                        <button class="btn btn-delete" onclick="deleteDraft('${escapeHtml(draft.draftId)}')">Delete</button>
                    </div>
                `;
                container.appendChild(card);
            });

        } catch (e) {
            console.error('Failed to load drafts', e);
        }
    }

    // Expose actions to global scope for inline handlers
    window.acceptDraft = async (id) => {
        try {
            const res = await fetch(`/api/drafts/${id}/accept`, { method: 'POST' });
            if (res.ok) {
                document.getElementById(`draft-${id}`).remove();
                showToast('Draft Accepted into Memory');
                loadStats(); // update count
                loadEntries(); // refresh KB
            }
        } catch (e) { }
    };

    window.deleteDraft = async (id) => {
        try {
            const res = await fetch(`/api/drafts/${id}`, { method: 'DELETE' });
            if (res.ok) {
                document.getElementById(`draft-${id}`).remove();
                showToast('Draft Deleted');
                loadStats();
            }
        } catch (e) { }
    };

    // Graph
    let network = null;
    async function loadGraph() {
        if (network) return; // already loaded

        try {
            const res = await fetch('/api/graph');
            const graphData = await res.json();

            const container = document.getElementById('network-container');

            const options = {
                layout: {
                    hierarchical: {
                        enabled: true,
                        direction: 'UD',          // Up-Down
                        sortMethod: 'directed',   // Follows dependency arrows
                        levelSeparation: 150,     // Space between tiers
                        nodeSpacing: 250,
                        treeSpacing: 400,
                    }
                },
                interaction: {
                    hover: true,
                    tooltipDelay: 200,
                    hideEdgesOnDrag: true
                },
                nodes: {
                    shape: 'dot',
                    size: 16,
                    font: { color: '#00FF41', face: 'monospace', size: 12 },
                    color: {
                        background: '#050505',
                        border: '#008F11',
                        highlight: { background: '#00FF41', border: '#FFFFFF' },
                        hover: { background: '#008F11', border: '#00FF41' }
                    },
                    shadow: { enabled: true, color: 'rgba(0, 255, 65, 0.4)', size: 10, x: 0, y: 0 }
                },
                edges: {
                    color: { color: '#004F09', highlight: '#00FF41', hover: '#008F11' },
                    arrows: { to: { enabled: true, scaleFactor: 0.5 } },
                    smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.4 }
                },
                physics: {
                    enabled: false // Physics usually conflicts with strict hierarchical layouts
                }
            };

            network = new vis.Network(container, graphData, options);

        } catch (e) {
            console.error('Failed to load graph', e);
            document.getElementById('network-container').innerHTML = '<p class="muted" style="padding: 20px;">Could not render graph data.</p>';
        }
    }

    // Init
    loadStats();
    loadEntries();
    loadDrafts();
});
