let tableData;
let nodes = [];
let selectedNode = null;

// DOM Elements
let tabDir, tabNet;
let viewDir, viewNet;
let codeOut, codeFallbackArea, codeDescText, codeFallbackBtn;
let displayTerm, displayTags, detailScroll, dirList;

// --- PASSWORD LOGIC ---
const PASSKEY = "critical2025"; // <--- CHANGE THIS PASSWORD IF YOU WANT
const TOKEN_KEY = "zine_access_granted"; // Key for local storage

function checkPassword() {
    const input = document.getElementById('pass-input');
    const overlay = document.getElementById('login-overlay');
    const error = document.getElementById('error-msg');
    
    if (input.value === PASSKEY) {
        // Correct Password: Store token and initialize
        localStorage.setItem(TOKEN_KEY, 'true'); 
        overlay.style.display = 'none';
        initializeApp();
    } else {
        // Wrong Password
        error.style.display = 'block';
        input.value = '';
    }
}

// --- MAIN APPLICATION INITIALIZATION ---
function initializeApp() {
    // 1. Get Elements
    tabDir = document.getElementById('tab-dir');
    tabNet = document.getElementById('tab-net');
    viewDir = document.getElementById('view-directory');
    viewNet = document.getElementById('view-network');
    
    // Code Panel Elements
    codeOut = document.getElementById('code-output');
    codeFallbackArea = document.getElementById('code-fallback-area');
    codeDescText = document.getElementById('code-desc-text');
    codeFallbackBtn = document.getElementById('code-fallback-btn');
    
    // Right Panel Elements
    displayTerm = document.getElementById('display-term');
    displayTags = document.getElementById('display-tags');
    detailScroll = document.getElementById('detail-scroll');
    dirList = document.getElementById('dir-list');

    // 2. Listeners
    tabDir.addEventListener('click', () => switchView('directory'));
    tabNet.addEventListener('click', () => switchView('network'));

    // 3. Canvas Setup (Re-show and resize the hidden canvas)
    let target = document.getElementById('p5-canvas-target');
    select('canvas').show(); // Show the canvas that was hidden in setup()
    select('canvas').parent('p5-canvas-target'); // Re-attach parent just in case
    
    // CRITICAL FIX: Ensure P5 variables (width/height) are updated *before* node creation
    windowResized();

    // 4. Data Load
    Papa.parse("data.csv", {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            tableData = results.data;
            initializeNodes();
            calculateConnections();
            populateList();
            
            // Auto-select first node
            if (nodes.length > 0) {
                selectNode(nodes[0]);
            }
        }
    });
}

// P5.js setup function creates the canvas but handles the access gate
function setup() {
    
    // Create canvas once, but make it invisible/tiny until initialized.
    createCanvas(1, 1).hide(); 
    
    // --- Access Check Start ---
    const overlay = document.getElementById('login-overlay');
    
    if (localStorage.getItem(TOKEN_KEY) === 'true') {
        // Token found: Hide overlay and initialize app immediately
        overlay.style.display = 'none';
        initializeApp();
    } else {
        // Token not found: Show overlay and wait for password
        overlay.style.display = 'flex';
        document.getElementById('login-btn').addEventListener('click', checkPassword);
        
        document.getElementById('pass-input').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
              checkPassword();
            }
        });
    }
    // --- Access Check End ---
}

function draw() {
    // We check if tableData exists to know if the app has initialized
    if (!tableData) {
        background(255); // Keep the canvas blank if not initialized
        return;
    }

    background(255); 
    
    // Only draw nodes if network view is active
    if (viewNet.classList.contains('active')) {
        strokeWeight(1);
        
        // Connections
        for (let node of nodes) {
            let isActive = (node === selectedNode || node.isHovered(mouseX, mouseY));
            
            for (let connection of node.connections) {
                let partner = connection.partner;
                if (isActive) {
                    stroke(0); 
                    line(node.x, node.y, partner.x, partner.y);
                } else {
                    stroke(0, 30); 
                    line(node.x, node.y, partner.x, partner.y);
                }
            }
        }

        rectMode(CENTER);
        for (let node of nodes) {
            node.display();
            node.move();
        }
    }
}

function switchView(view) {
    if (view === 'directory') {
        tabDir.classList.add('active');
        tabNet.classList.remove('active');
        viewDir.classList.add('active');
        viewNet.classList.remove('active');
    } else {
        tabNet.classList.add('active');
        tabDir.classList.remove('active');
        viewNet.classList.add('active');
        viewDir.classList.remove('active');
        windowResized();
    }
}

function windowResized() {
    let target = document.getElementById('p5-canvas-target');
    if (target && target.offsetWidth > 0) {
        resizeCanvas(target.offsetWidth, target.offsetHeight);
    }
}

function initializeNodes() {
  nodes = [];
  // Since windowResized() was called before this function, 
  // p5.js width/height are now correct.
  for (let i = 0; i < tableData.length; i++) {
     if(tableData[i]['Glossary Term']) {
         nodes.push(new GlossaryNode(tableData[i], i));
     }
  }
}

function calculateConnections() {
  for (let i = 0; i < nodes.length; i++) {
    let nodeA = nodes[i];
    if(!hasContent(nodeA.data['Keywords'])) continue;
    let tagsA = nodeA.data['Keywords'].split(';').map(s => s.trim().toLowerCase());
    
    for (let j = i + 1; j < nodes.length; j++) {
      let nodeB = nodes[j];
      if(!hasContent(nodeB.data['Keywords'])) continue;
      let tagsB = nodeB.data['Keywords'].split(';').map(s => s.trim().toLowerCase());

      if (tagsA.some(t => tagsB.includes(t))) {
        nodeA.connections.push({ partner: nodeB });
        nodeB.connections.push({ partner: nodeA });
      }
    }
  }
}

function populateList() {
    dirList.innerHTML = '';
    nodes.forEach(node => {
        let li = document.createElement('li');
        li.innerText = node.data['Glossary Term'];
        li.addEventListener('click', () => selectNode(node));
        dirList.appendChild(li);
    });
}

function selectNode(node) {
    selectedNode = node;
    renderDetails(node.data);
}

function mousePressed() {
    if (viewNet.classList.contains('active')) {
        for (let node of nodes) {
            if (node.isHovered(mouseX, mouseY)) {
                selectNode(node);
                break;
            }
        }
    }
}

// --- Node Class ---
class GlossaryNode {
  constructor(data, id) {
    this.data = data;
    this.id = id;
    this.size = 15;
    
    let padding = 30;
    // We can rely on width/height being correct here because windowResized() ran in initializeApp()
    let safeW = width;
    let safeH = height;
    
    this.x = random(padding, safeW - padding);
    this.y = random(padding, safeH - padding);
    
    this.connections = [];
    
    let cat = (data['Category'] || "").toLowerCase();
    this.color = color(100); 
    
    if (cat.includes('brain')) this.color = color('#008060');
    else if (cat.includes('search')) this.color = color('#0055cc');
    else if (cat.includes('llm')) this.color = color('#cc3300');
    
    if(cat.includes(';') || (cat.includes('brain') && cat.includes('llm'))) {
        this.color = color(50); 
    }
  }

  move() {
    this.x += random(-0.2, 0.2);
    this.y += random(-0.2, 0.2);
    this.x = constrain(this.x, 10, width - 10);
    this.y = constrain(this.y, 10, height - 10);
  }

  isHovered(mx, my) {
    return (mx > this.x - this.size/2 && mx < this.x + this.size/2 &&
            my > this.y - this.size/2 && my < this.y + this.size/2);
  }

  display() {
    stroke(0);
    strokeWeight(1);
    fill(this.color);
    rect(this.x, this.y, this.size, this.size);

    if (selectedNode === this) {
        noFill();
        stroke(0);
        strokeWeight(2);
        rect(this.x, this.y, this.size * 2, this.size * 2);
    }

    if (this.isHovered(mouseX, mouseY) || selectedNode === this) {
        fill(0);
        noStroke();
        textAlign(LEFT);
        textSize(12);
        text(this.data['Glossary Term'].toUpperCase(), this.x + 15, this.y + 5);
    }
  }
}

// --- Helper Functions ---

function formatText(rawText) {
    if (!rawText) return "";
    return rawText.split('\n')
        .filter(t => t.trim().length > 0)
        .map(t => `<p>${t}</p>`)
        .join('');
}

function hasContent(str) {
    return (str && str.toString().trim().length > 0);
}

function linkify(text) {
    if(!text) return "";
    var urlRegex =/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(urlRegex, function(url) {
        return '<a href="' + url + '" target="_blank">' + url + '</a>';
    });
}

function parseCodeComponent(rawString) {
    if(!rawString) return { url: null, desc: "" };
    let urlRegex = /(https?:\/\/[^\s]+)/g;
    let match = rawString.match(urlRegex);
    let url = match ? match[0] : null;
    let desc = rawString.replace(urlRegex, "").trim();
    return { url, desc };
}

function isEmbeddable(url) {
    if(!url) return false;
    return (url.includes('editor.p5js.org') || 
            url.includes('youtube.com') || 
            url.includes('vimeo.com') ||
            url.match(/\.(jpeg|jpg|gif|png)$/i));
}

function renderDetails(data) {
    displayTerm.innerText = data['Glossary Term'];
    
    // Tags
    displayTags.innerHTML = '';
    if(hasContent(data['Keywords'])) {
        data['Keywords'].split(';').forEach(tag => {
            if(tag.trim()) {
                let s = document.createElement('span');
                s.className = 'tag';
                s.innerText = tag.trim();
                displayTags.appendChild(s);
            }
        });
    }

    // Code Component Logic (With Fallback)
    let codeRaw = data['Code Component'];
    if (hasContent(codeRaw)) {
        let codeData = parseCodeComponent(codeRaw);
        
        if (codeData.url && isEmbeddable(codeData.url)) {
            codeOut.style.display = 'flex';
            codeFallbackArea.style.display = 'none';
            
            // --- Code Component Error Handling START ---
            let embedHtml = '';
            let url = codeData.url;
            
            if(url.match(/\.(jpeg|jpg|gif|png)$/i)) {
                 embedHtml = `<img src="${url}" onerror="this.outerHTML='<div class=\\'waiting-text\\' style=\\'color:red;\\'>ERROR: Code Image not found at ${url}<br>Check media folder case/path.</div>'">`;
            } else {
                 embedHtml = `<iframe src="${url}" title="Code Component" onerror="this.outerHTML='<div class=\\'waiting-text\\' style=\\'color:red;\\'>ERROR: IFrame failed to load ${url}<br>Check URL or try external link.</div>'"></iframe>`;
            }
            codeOut.innerHTML = embedHtml;
            // --- Code Component Error Handling END ---

        } else if (codeData.url) {
            codeOut.style.display = 'none';
            codeFallbackArea.style.display = 'flex';
            codeDescText.innerText = codeData.desc || "Interactive component available via external link.";
            codeFallbackBtn.href = codeData.url;
        } else {
            codeOut.style.display = 'none';
            codeFallbackArea.style.display = 'flex';
            codeDescText.innerText = codeRaw; 
            codeFallbackBtn.style.display = 'none';
        }
    } else {
        codeOut.style.display = 'flex';
        codeFallbackArea.style.display = 'none';
        codeOut.innerHTML = `<div class="waiting-text">NO CODE SIGNAL</div>`;
    }

    // Cards
    detailScroll.innerHTML = '';
    const addCard = (title, html) => {
        let d = document.createElement('div');
        d.className = 'card';
        d.innerHTML = `<h3>${title}</h3>${html}`;
        detailScroll.appendChild(d);
    }

    // --- 1. Contributors ---
    if (hasContent(data['Group members'])) {
        let cats = (data['Category'] || "").split(';').map(s=>s.trim()).filter(Boolean);
        let badges = ``;
        cats.forEach(c => {
            let cls = 'cat-default';
            let lowerC = c.toLowerCase();
            if(lowerC.includes('brain')) cls = 'cat-brain';
            else if(lowerC.includes('search')) cls = 'cat-search';
            else if(lowerC.includes('llm')) cls = 'cat-llm';
            badges += `<span class="method-badge ${cls}">${c}</span>`;
        });
        addCard('CONTRIBUTORS', `<span class="people-name">${data['Group members']}</span>${badges}`);
    }

    // --- 2. Definition (PDF Handling Updated for Local Files) ---
    const definitionContent = data['Term Definition'];
    if (hasContent(definitionContent)) {
        let htmlContent = '';
        
        // --- NEW PDF CHECK LOGIC ---
        const lowerDef = definitionContent.toLowerCase();
        const isPdfFile = lowerDef.endsWith('.pdf');
        const isExternalUrl = lowerDef.startsWith('http');
        
        if (isPdfFile && !isExternalUrl) {
            // Case 1: Local PDF filename found (Embed PDF)
            let pdfLink = "media/" + definitionContent; // Prepend media/ since it's local filename
            
            htmlContent = `
                <div style="height: 500px; border: 1px solid #ccc;">
                    <iframe src="${pdfLink}" width="100%" height="100%" style="border: none;" 
                        onerror="this.outerHTML='<div class=\\'waiting-text\\' style=\\'color:red;\\'>ERROR: Local PDF not found at ${pdfLink}<br>Check media folder case/path.</div>'"></iframe>
                </div>
                <p class="meta-text" style="margin-top: 10px;">Definition embedded as PDF: <a href="${pdfLink}" target="_blank">Download PDF ↗</a></p>
            `;
        } else {
            // Case 2: Standard text OR external PDF URL (Format as text/links)
            
            let formattedParagraphs = formatText(definitionContent);
            htmlContent = linkify(formattedParagraphs);
        }
        addCard('DEFINITION', htmlContent);
    }
    
    // --- 3. GAI Engagement ---
    if (hasContent(data['Description of how the definition was developed and how GAI was engaged in the process'])) {
        addCard('GAI ENGAGEMENT', formatText(data['Description of how the definition was developed and how GAI was engaged in the process']));
    }
    
    // --- 4. Related Projects ---
    if (hasContent(data['Related code/art/media projects'])) {
        let paragraphs = formatText(data['Related code/art/media projects']);
        addCard('RELATED PROJECTS', linkify(paragraphs));
    }

    // --- 5. Project Media ---
    if (hasContent(data['Project Media'])) {
        let mediaFiles = data['Project Media'].split(';').map(s => s.trim()).filter(Boolean);
        let combinedHtml = "";

        mediaFiles.forEach(mediaFile => {
            let src = mediaFile;
            if (!mediaFile.startsWith('http')) {
                src = "media/" + mediaFile;
            }

            // --- Media Asset Error Handling START ---
            let mediaErrorHtml = `'<div class=\\'waiting-text\\' style=\\'color:red;\\'>ERROR: Media file not found at ${src}<br>Check media folder case/path.</div>'`;
            
            combinedHtml += `<div class="media-item" style="margin-bottom: 20px;">`;
            
            if (mediaFile.match(/\.(mp4|webm|mov)$/i)) {
                 combinedHtml += `<video controls style="width:100%"><source src="${src}" onerror="this.outerHTML=${mediaErrorHtml}"></video>`;
            } else {
                 combinedHtml += `<img src="${src}" style="width:100%; border: 1px solid var(--ink); display:block;" onerror="this.outerHTML=${mediaErrorHtml}">`;
            }
            combinedHtml += `</div>`;
        });
        
        addCard('PROJECT MEDIA', `<div class="media-box">${combinedHtml}</div>`);
    }
}
