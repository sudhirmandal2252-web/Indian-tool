// --------- IMPORTANT: add your own key for local testing only ------------
const API_KEY = "AIzaSyCJ8xK5TyPzuUlJ3cdKOlryLOdtuj5MrV0"; // <-- Paste your new API key here for local testing only.
// -------------------------------------------------------------------------

// UI elements
const goBtn = document.getElementById('goBtn');
const input = document.getElementById('inputUrl');
const videoDetail = document.getElementById('videoDetail');
const messageBox = document.getElementById('messageBox');
const tagsBox = document.getElementById('tagsBox');

function showMessage(text, type='error') {
  // type: 'error' or 'success' (styling kept simple)
  messageBox.style.display = 'block';
  messageBox.innerText = text;
  if (type === 'success') messageBox.style.background = '#eef9f0';
  else messageBox.style.background = '#fff3f3';
  // auto hide after 4s
  setTimeout(()=> {
    messageBox.style.display = 'none';
  }, 4000);
}

function extractYouTubeId(inputStr){
  inputStr = inputStr.trim();
  // direct id
  if (/^[a-zA-Z0-9_-]{11}$/.test(inputStr)) return inputStr;

  try {
    const url = new URL(inputStr);
    const host = url.hostname.toLowerCase();

    // standard watch link
    if (host.includes('youtube.com')) {
      // handle /watch?v=
      const v = url.searchParams.get('v');
      if (v) return v;

      // shorts
      const path = url.pathname.split('/');
      if (path.includes('shorts')) {
        const idx = path.indexOf('shorts');
        return path[idx+1] || null;
      }

      // /embed/ID
      if (url.pathname.includes('/embed/')) {
        return url.pathname.split('/embed/')[1].split('/')[0];
      }

      // channel or others -> return null
      return null;
    }

    // youtu.be short
    if (host.includes('youtu.be')) {
      return url.pathname.replace('/', '').split('?')[0];
    }

  } catch(e){
    // not a URL, maybe user pasted "v=ID" or extra text — try regex
    const m = inputStr.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (m && m[1]) return m[1];
    const s = inputStr.match(/([a-zA-Z0-9_-]{11})/);
    if (s && s[1]) return s[1];
  }

  return null;
}

async function fetchVideoDetails(videoId){
  if (!API_KEY) {
    showMessage('API key missing. Paste API_KEY in script.js for full details.', 'error');
    return null;
  }

  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${encodeURIComponent(videoId)}&key=${API_KEY}`;
  try {
    const r = await fetch(url);
    if (!r.ok) {
      const txt = await r.text();
      throw new Error('API error ' + r.status + ' - ' + txt);
    }
    const data = await r.json();
    return data;
  } catch (err) {
    throw err;
  }
}

// Simple AI tags generator (Option A): from title + description
function simpleTagGenerator(title='', description='') {
  const text = (title + ' ' + description).toLowerCase();
  const cleaned = text.replace(/https?:\/\/\S+/g, '').replace(/[^\w\s]/g,' ');
  const words = cleaned.split(/\s+/).filter(w => w.length > 3);
  const freq = {};
  words.forEach(w => freq[w] = (freq[w]||0) + 1);
  const sorted = Object.keys(freq).sort((a,b) => freq[b]-freq[a]);
  const tags = sorted.slice(0,10);
  // generate some long-tail combos
  const longtails = [];
  if (sorted[0] && sorted[1]) longtails.push(`${sorted[0]} ${sorted[1]}`);
  if (sorted[1] && sorted[2]) longtails.push(`${sorted[1]} ${sorted[2]}`);
  return {highRank: tags.slice(0,6), all: [...new Set([...tags, ...longtails])]};
}

function setThumb(url){
  const t = document.getElementById('thumbPreview');
  if (!url) {
    t.style.backgroundImage = '';
    t.style.backgroundColor = '#ddd';
    return;
  }
  t.style.backgroundImage = `url(${url})`;
  t.style.backgroundSize = 'cover';
  t.style.backgroundPosition = 'center';
}

function renderTags(allTags) {
  const container = document.getElementById('tagsList');
  container.innerHTML = '';
  allTags.forEach(tag => {
    const el = document.createElement('span');
    el.className = 'tag';
    el.textContent = tag;
    container.appendChild(el);
  });
  tagsBox.style.display = allTags.length ? 'block' : 'none';
}

// replace alerts with inline small feedback
function showCopiedMessage(text='Copied') {
  showMessage(text, 'success');
}

// Wire up copy/download buttons
// === Function to force download any image ===
function forceDownload(url, filename) {
  fetch(url)
    .then(res => res.blob())
    .then(blob => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    })
    .catch(() => showMessage("Failed to download thumbnail", "error"));
}

// === Wire up copy/download buttons ===
function wireQuickActions(snippet, mergedTags, aiTags, channelId) {

  document.getElementById('copyTitle').onclick = () => {
    navigator.clipboard.writeText(snippet.title || '').then(()=> showCopiedMessage('Title copied'));
  };

  document.getElementById('copyDesc').onclick = () => {
    navigator.clipboard.writeText(snippet.description || '').then(()=> showCopiedMessage('Description copied'));
  };

  document.getElementById('copyAllTags').onclick = () => {
    navigator.clipboard.writeText(mergedTags.join(', ')).then(()=> showCopiedMessage('Tags copied'));
  };

  document.getElementById('copyTags').onclick = () => {
    navigator.clipboard.writeText((snippet.tags || []).join(', ')).then(()=> showCopiedMessage('API tags copied'));
  };

  document.getElementById('copyKeywords').onclick = () => {
    navigator.clipboard.writeText(aiTags.highRank.join(', ')).then(()=> showCopiedMessage('Keywords copied'));
  };

  // ✅ THUMBNAIL DOWNLOAD FIXED (HD version)
  document.getElementById('downloadThumb').onclick = () => {
    const bg = document.getElementById('thumbPreview').style.backgroundImage;
    if (!bg) { showMessage('No thumbnail available'); return; }

    // Clean URL from style
    const url = bg.slice(5, -2);

    // Try to download HD
    const videoId = extractYouTubeId(input.value.trim());
    const hdUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    forceDownload(hdUrl || url, `${videoId}_thumbnail_hd.jpg`);
    showMessage('Thumbnail Downloaded!', 'success');
  };

  document.getElementById('viewProfile').onclick = () => {
    if (!channelId) { showMessage('Channel ID not available'); return; }
    window.open(`https://www.youtube.com/channel/${channelId}`, '_blank');
  };
}

// Main click handler
goBtn.addEventListener('click', async () => {
  const val = input.value.trim();
  if (!val) { showMessage('Paste a YouTube video URL or ID'); return; }

  const videoId = extractYouTubeId(val);
  if (!videoId) { showMessage('Invalid URL or ID — try full YouTube watch URL or short youtu.be link'); return; }

  // reset UI
  messageBox.style.display = 'none';
  videoDetail.style.display = 'none';
  tagsBox.style.display = 'none';
  setThumb(null);

  goBtn.disabled = true; goBtn.textContent = 'Loading...';

  try {
    const data = await fetchVideoDetails(videoId);
    if (!data || !data.items || data.items.length === 0) {
      // Show Not Found in UI (no alert)
      showMessage('Video not found or API returned no data', 'error');
      goBtn.disabled=false; goBtn.textContent='Go';
      return;
    }

    const item = data.items[0];
    const sn = item.snippet || {};
    const st = item.statistics || {};
    const channelId = sn.channelId || null;

    // fill UI (keeping exact layout)
    document.getElementById('vTitle').textContent = sn.title || '';
    document.getElementById('vPublish').textContent = sn.publishedAt ? 'Publish at ' + new Date(sn.publishedAt).toLocaleDateString() : '';
    document.getElementById('vViews').textContent = '👁️ ' + (st.viewCount || '0');
    document.getElementById('vLikes').textContent = '👍 ' + (st.likeCount || '0');
    document.getElementById('vDesc').textContent = sn.description || '-';
    document.getElementById('vComments').textContent = st.commentCount || '0';

    // thumbnail choose best available
    const thumbUrl = (sn.thumbnails && (sn.thumbnails.maxres?.url || sn.thumbnails.high?.url || sn.thumbnails.medium?.url || sn.thumbnails.default?.url)) || '';
    setThumb(thumbUrl);

    // tags logic: API tags + AI fallback
    const apiTags = sn.tags || [];
    const aiTags = simpleTagGenerator(sn.title || '', sn.description || '');
    const mergedTags = Array.from(new Set([...(apiTags || []), ...aiTags.all]));

    renderTags(mergedTags);

    // show video detail
    videoDetail.style.display = 'block';
    // wire actions
    wireQuickActions(sn, mergedTags, aiTags, channelId);

    // Ensure read more link appears if description long
    const descEl = document.getElementById('vDesc');
    const readMore = document.getElementById('readMore');
    if ((sn.description || '').length > 260) {
      readMore.style.display = 'inline-block';
      readMore.onclick = (e) => { e.preventDefault(); descEl.style.maxHeight = 'none'; readMore.style.display = 'none'; };
    } else readMore.style.display = 'none';

  } catch (err) {
    // show error inside UI — do not change layout
    showMessage('Error fetching video: ' + (err.message || 'unknown'), 'error');
  }

  goBtn.disabled = false; goBtn.textContent = 'Go';
});

// =============== AI MINI TOOL BOX ===============

const aiBox = document.getElementById("aiBox");
const aiTitle = document.getElementById("aiTitle");
const aiInput = document.getElementById("aiInput");
const aiOutput = document.getElementById("aiOutput");
const aiGenerateBtn = document.getElementById("aiGenerateBtn");

// OPEN TOOL UI
document.getElementById("toolTags").onclick = () => openTool("Video Tags Extractor");
document.getElementById("toolKeyword").onclick = () => openTool("Keyword Suggestion");
document.getElementById("toolHashtag").onclick = () => openTool("AI Hashtag Generator");

function openTool(name){
  aiBox.style.display = "block";
  aiOutput.style.display = "none";
  aiInput.value = "";
  aiTitle.innerText = name;
  aiInput.placeholder = "Write here…";
  window.scrollTo({top: aiBox.offsetTop - 20, behavior:"smooth"});
}

// GENERATE AI RESULT
aiGenerateBtn.onclick = () => {
  const text = aiInput.value.trim();
  if(!text){
    aiOutput.style.display = "block";
    aiOutput.innerHTML = "Please type something!";
    return;
  }

  aiOutput.style.display = "block";

  if(aiTitle.innerText === "Video Tags Extractor"){
    aiOutput.innerHTML = `
      Suggested Tags:<br><br>
      ${text.toLowerCase().split(" ").join(", ")}, viral, trending, india, youtube
    `;
  }

  else if(aiTitle.innerText === "Keyword Suggestion"){
    aiOutput.innerHTML = `
      SEO Keywords:<br><br>
      best ${text} video, ${text} in india, how to ${text}, ${text} tutorial
    `;
  }

  else if(aiTitle.innerText === "AI Hashtag Generator"){
    aiOutput.innerHTML = `
      Hashtags:<br><br>
      #${text.replace(/ /g,"")} #viral #trending #indiagaming #youtube
    `;
  }
};
const gridCards = document.querySelectorAll('.grid-card');

gridCards.forEach(card => {
  card.addEventListener('click', () => {

    const tool = card.dataset.tool; // Identify tool

    // ========== Earning Calculator ==========
    // ========== Earning Calculator ==========
if (tool === "earning") {

  const w = window.open('', '_blank');

  if (!w) {
    alert("Please allow popups for this site!");
    return;
  }

  w.document.write(`
    <html>
    <head>
      <title>Earning Calculator</title>
      <style>
        body { font-family: Arial; padding:20px;
               background:linear-gradient(135deg,#1e3c72,#2a5298);
               color:white;
               display:flex; flex-direction:column; align-items:center; }
        h2 { margin-bottom:20px; }
        input { padding:10px; width:220px; margin:10px 0;
                font-size:16px; border-radius:5px; border:none; }
        button { padding:10px 20px; margin-top:10px; cursor:pointer;
                 font-size:16px; border:none; border-radius:5px; }
        .result { margin-top:20px; font-size:18px; font-weight:bold; text-align:center; }
        .back-btn { margin-top:30px; padding:10px 20px; background:#000;
                    color:white; border:none; cursor:pointer; border-radius:5px; }
      </style>
    </head>

    <body>
      <h2>Earning Calculator</h2>

      <input type="text" id="viewsInput" placeholder="Enter views" />
      <button onclick="calculateEarning()">Calculate</button>

      <div class="result" id="earningOutput"></div>

      <button class="back-btn" onclick="window.close()">← Back</button>

      <script>

        // Convert k/m to number
        function convertToNumber(val){
          val = val.toLowerCase().trim();

          if(val.endsWith("k")) {
            return parseFloat(val.replace("k","")) * 1000;
          }
          else if(val.endsWith("m")) {
            return parseFloat(val.replace("m","")) * 1000000;
          }
          return parseFloat(val);
        }

        // Format views into 1K / 10.5K / 1.2M
        function formatViews(n){
          if(n >= 1000000) return (n/1000000).toFixed(1).replace('.0','') + "M";
          if(n >= 1000) return (n/1000).toFixed(1).replace('.0','') + "K";
          return n;
        }

        function calculateEarning() {
          let inputVal = document.getElementById('viewsInput').value;

          let views = convertToNumber(inputVal);

          if (!views || isNaN(views)) {
            document.getElementById('earningOutput').innerHTML = "Enter valid views!";
            return;
          }

          const lowRPM = 0.15;
          const highRPM = 3;

          const lowEarn = (views / 1000) * lowRPM;
          const highEarn = (views / 1000) * highRPM;

          document.getElementById('earningOutput').innerHTML =
            "Views: " + formatViews(views) + "<br><br>" +
            "Low RPM: $" + lowEarn.toFixed(2) + "<br>" +
            "High RPM: $" + highEarn.toFixed(2);
        }
      </script>
    </body>
    </html>
  `);

  w.document.close();
  return;
}


    // ========== Find Competitor Tool ==========

    if (tool === "competitor") {

      const w = window.open('', '_blank');

      if (!w) {
        alert("Please allow popups for this site!");
        return;
      }

      w.document.write(`
        <html>
        <head>
          <title>Find Competitor</title>
          <style>
            body { font-family: Arial; padding:20px; background:#eef2ff;
                   display:flex; flex-direction:column; align-items:center; }
            h2 { margin-bottom:15px; }
            input { padding:12px; width:260px; margin:10px 0; font-size:16px; border-radius:8px; border:1px solid #aaa; }
            button { padding:10px 20px; margin-top:10px; cursor:pointer; font-size:16px;
                     background:#4C7CFF; color:white; border:none; border-radius:8px; }
            .back-btn { margin-top:20px; background:#555; }
            .result-box { margin-top:20px; width:90%; }
            .card { background:white; padding:12px; border-radius:10px;
                    box-shadow:0 3px 10px rgba(0,0,0,0.1); margin-bottom:15px;
                    animation: fadeIn 0.4s ease; }
            .card img { width:100%; border-radius:10px; }
            @keyframes fadeIn {
              from { opacity:0; transform: translateY(10px); }
              to { opacity:1; transform: translateY(0); }
            }
          </style>
        </head>

        <body>
          <h2>Find Competitor</h2>

          <input id="keywordInput" placeholder="Enter Video Tittle" />
          <button onclick="findComp()">Search</button>

          <div id="results" class="result-box"></div>

          <button class="back-btn" onclick="window.close()">← Back</button>

          <script>
            async function findComp() {
              let q = document.getElementById('keywordInput').value;
              if (!q) {
                document.getElementById('results').innerHTML = "Please enter a keyword";
                return;
              }

              const apiKey = "AIzaSyCJ8xK5TyPzuUlJ3cdKOlryLOdtuj5MrV0";

              document.getElementById('results').innerHTML = "Searching competitors... ⏳";

              const url =
              \`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=\${q}&maxResults=10&key=\${apiKey}\`;

              let res = await fetch(url);
              let data = await res.json();

              let html = "";
              data.items.forEach(item => {
                html += \`
                  <div class="card">
                    <img src="\${item.snippet.thumbnails.high.url}">
                    <h3>\${item.snippet.channelTitle}</h3>
                    <a href="https://youtube.com/channel/\${item.snippet.channelId}" target="_blank">Visit Channel →</a>
                  </div>
                \`;
              });

              document.getElementById('results').innerHTML = html;
            }
          </script>
        </body>
        </html>
      `);

      w.document.close();
      return;
    }


  


    // ========== trading ==========
    if (tool === "Trading") {

  const w = window.open('', '_blank');

  if (!w) {
    alert("Please allow popups for this site!");
    return;
  }

  w.document.write(`
    <html>
    <head>
      <title>Trading Videos</title>
      <style>
        body { font-family: Arial; padding:20px; background:#eef2ff;
               display:flex; flex-direction:column; align-items:center; }
        h2 { margin-bottom:15px; }
        input { padding:12px; width:260px; margin:10px 0; font-size:16px; border-radius:8px; border:1px solid #aaa; }
        button { padding:10px 20px; margin-top:10px; cursor:pointer; font-size:16px;
                 background:#4C7CFF; color:white; border:none; border-radius:8px; }
        .back-btn { margin-top:20px; background:#555; }
        .result-box { margin-top:20px; width:90%; }
        .card { background:white; padding:12px; border-radius:10px;
                box-shadow:0 3px 10px rgba(0,0,0,0.1); margin-bottom:15px;
                animation: fadeIn 0.4s ease; }
        .card img { width:100%; border-radius:10px; }
        @keyframes fadeIn {
          from { opacity:0; transform: translateY(10px); }
          to { opacity:1; transform: translateY(0); }
        }
      </style>
    </head>

    <body>
      <h2>Trading Videos Finder</h2>

      <input id="keywordInput" placeholder="Enter trading keyword (e.g. stock, crypto)" />
      <button onclick="findTrading()">Search</button>

      <div id="results" class="result-box"></div>

      <button class="back-btn" onclick="window.close()">← Back</button>

      <script>
        async function findTrading() {
          let q = document.getElementById('keywordInput').value;
          if (!q) {
            document.getElementById('results').innerHTML = "Please enter a keyword";
            return;
          }

          const apiKey = "AIzaSyCJ8xK5TyPzuUlJ3cdKOlryLOdtuj5MrV0";

          document.getElementById('results').innerHTML = "Fetching trading videos... ⏳";

          const url =
            \`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=\${q} trading&maxResults=12&key=\${apiKey}\`;

          let res = await fetch(url);
          let data = await res.json();

          let html = "";
          data.items.forEach(item => {
            html += \`
              <div class="card">
                <img src="\${item.snippet.thumbnails.high.url}">
                <h3>\${item.snippet.title}</h3>
                <a href="https://www.youtube.com/watch?v=\${item.id.videoId}" target="_blank">Watch Video →</a>
              </div>
            \`;
          });

          document.getElementById('results').innerHTML = html;
        }
      </script>
    </body>
    </html>
  `);

  w.document.close();
  return;
}
    if (tool === "video") {
  const w = window.open('', '_blank');
  if (!w) {
    alert("Please allow popups!");
    return;
  }

  w.document.write(`
  <html>
  <head>
    <title>Video & Channel Earning Calculator</title>
    <style>
      body { font-family: 'Poppins', sans-serif; background: linear-gradient(135deg, #6a11cb, #2575fc); margin:0; padding:20px; color:white; display:flex; flex-direction:column; align-items:center;}
      h2 { margin-top:10px; text-shadow:0 2px 6px rgba(0,0,0,0.4);}
      .card { width:90%; max-width:450px; background:rgba(255,255,255,0.15); padding:18px; border-radius:16px; box-shadow:0 8px 20px rgba(0,0,0,0.25); backdrop-filter:blur(6px); margin-top:20px; animation:fade 0.4s ease;}
      @keyframes fade { from { opacity:0; transform:translateY(10px);} to { opacity:1; transform:translateY(0); } }
      input { width:100%; padding:12px; border-radius:8px; border:none; margin-top:10px; font-size:15px; }
      button { width:100%; padding:12px; margin-top:12px; border:none; background:#fff; color:#2575fc; font-size:16px; border-radius:10px; cursor:pointer; font-weight:bold; }
      .thumbnail { width:100%; border-radius:12px; margin-top:12px; }
      .earning-box { margin-top:15px; padding:12px; background:rgba(0,0,0,0.25); border-radius:12px; font-size:17px; }
      .back-btn { margin-top:25px; background:black; color:white; }
    </style>
  </head>
  <body>
    <h2>🎬 YouTube Video & Creator Earning</h2>

    <div class="card">
      <input id="videoURL" placeholder="Paste YouTube Video URL..." />
      <button onclick="getVideoData()">Analyze Video</button>
      <div id="videoResult"></div>
    </div>

    <div class="card">
      <input id="channelURL" placeholder="Paste YouTube Channel URL..." />
      <button onclick="getChannelEarning()">Check Creator Lifetime Earning</button>
      <div id="channelResult"></div>
    </div>

    <button class="back-btn" onclick="window.close()">← Back</button>

<script>
  const apiKey = "AIzaSyCJ8xK5TyPzuUlJ3cdKOlryLOdtuj5MrV0";
  const usdToInr = 83; // 1 USD = 83 INR

  async function getVideoData() {
    const url = document.getElementById("videoURL").value.trim();
    const videoId = extractVideoID(url);
    const resultDiv = document.getElementById("videoResult");

    if (!videoId) { resultDiv.innerHTML = "❌ Invalid Video URL"; return; }
    resultDiv.innerHTML = "⏳ Loading...";

    try {
      const api = \`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=\${videoId}&key=\${apiKey}\`;
      const res = await fetch(api);
      const data = await res.json();

      if (!data.items.length) { resultDiv.innerHTML = "❌ Video Not Found"; return; }

      const video = data.items[0];
      const title = video.snippet.title;
      const thumb = video.snippet.thumbnails.high.url;
      const views = Number(video.statistics.viewCount);

      const lowRPM = 0.15;
      const highRPM = 4;

      const lowEarnUSD = (views / 1000) * lowRPM;
      const highEarnUSD = (views / 1000) * highRPM;
      const lowEarnINR = lowEarnUSD * usdToInr;
      const highEarnINR = highEarnUSD * usdToInr;

      resultDiv.innerHTML = \`
        <img class="thumbnail" src="\${thumb}">
        <h3>\${title}</h3>
        <div class="earning-box">
          👁️ Views: <b>\${views.toLocaleString()}</b><br><br>
          💰 Low RPM: <b>$\${lowEarnUSD.toFixed(2)} / ₹\${lowEarnINR.toLocaleString()}</b><br>
          💰 High RPM: <b>$\${highEarnUSD.toFixed(2)} / ₹\${highEarnINR.toLocaleString()}</b>
        </div>
      \`;
    } catch(err) {
      resultDiv.innerHTML = "❌ Error fetching video data";
    }
  }

  function extractVideoID(url) {
    try {
      const u = new URL(url);
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      if (url.includes("youtu.be/")) return url.split("youtu.be/")[1].split("?")[0];
    } catch {}
    return null;
  }

  async function getChannelEarning() {
    const url = document.getElementById("channelURL").value.trim();
    const channelId = await resolveChannelID(url);
    const resultDiv = document.getElementById("channelResult");

    if (!channelId) { resultDiv.innerHTML = "❌ Invalid Channel URL"; return; }
    resultDiv.innerHTML = "⏳ Loading...";

    try {
      const api = \`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=\${channelId}&key=\${apiKey}\`;
      const res = await fetch(api);
      const data = await res.json();

      if (!data.items.length) { resultDiv.innerHTML = "❌ Channel Not Found"; return; }

      const info = data.items[0];
      const title = info.snippet.title;
      const subs = Number(info.statistics.subscriberCount);
      const views = Number(info.statistics.viewCount);

      const lowRPM = 0.15;
      const highRPM = 4;

      const lowEarnUSD = (views / 1000) * lowRPM;
      const highEarnUSD = (views / 1000) * highRPM;
      const lowEarnINR = lowEarnUSD * usdToInr;
      const highEarnINR = highEarnUSD * usdToInr;

      resultDiv.innerHTML = \`
        <div class="earning-box">
          👤 Creator: <b>\${title}</b><br>
          🔔 Subscribers: <b>\${subs.toLocaleString()}</b><br>
          👁️ Total Views: <b>\${views.toLocaleString()}</b><br><br>
          💰 Lifetime Low RPM Earning: <b>$\${lowEarnUSD.toFixed(2)} / ₹\${lowEarnINR.toLocaleString()}</b><br>
          💰 Lifetime High RPM Earning: <b>$\${highEarnUSD.toFixed(2)} / ₹\${highEarnINR.toLocaleString()}</b>
        </div>
      \`;
    } catch(err) {
      resultDiv.innerHTML = "❌ Error fetching channel data";
    }
  }

  async function resolveChannelID(url) {
    try {
      if (url.includes("/channel/")) return url.split("/channel/")[1].split("/")[0];

      const username = url.split("/user/")[1] || url.split("/c/")[1];
      if (!username) return null;

      const api = \`https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=\${username}&key=\${apiKey}\`;
      const res = await fetch(api);
      const data = await res.json();
      if (data.items && data.items.length) return data.items[0].id;
    } catch {}
    return null;
  }
</script>
  </body>
  </html>
  `);

  w.document.close();
}
    if (tool === "discraption") {
  const w = window.open('', '_blank');
  if (!w) {
    alert("Please allow popups!");
    return;
  }

  w.document.write(`
  <html>
  <head>
    <title>AI Description Generator</title>
    <style>
      body {
        font-family: 'Poppins', sans-serif;
        background: linear-gradient(135deg, #6a11cb, #2575fc);
        margin: 0;
        padding: 20px;
        color: white;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      h2 {
        margin-top: 10px;
        text-shadow: 0 2px 6px rgba(0,0,0,0.4);
      }

      .card {
        width: 90%;
        max-width: 500px;
        background: rgba(255,255,255,0.15);
        padding: 18px;
        border-radius: 16px;
        box-shadow: 0 8px 20px rgba(0,0,0,0.25);
        backdrop-filter: blur(6px);
        margin-top: 20px;
        animation: fade 0.4s ease;
      }

      @keyframes fade {
        from { opacity:0; transform:translateY(10px);}
        to { opacity:1; transform:translateY(0);}
      }

      textarea {
        width: 100%;
        padding: 12px;
        border-radius: 8px;
        border: none;
        margin-top: 10px;
        font-size: 15px;
        resize: none;
        height: 120px;
      }

      button {
        width: 100%;
        padding: 12px;
        margin-top: 12px;
        border: none;
        background: #fff;
        color: #2575fc;
        font-size: 16px;
        border-radius: 10px;
        cursor: pointer;
        font-weight: bold;
      }

      .desc-box {
        margin-top: 15px;
        padding: 12px;
        background: rgba(0,0,0,0.25);
        border-radius: 12px;
        font-size: 15px;
        max-height: 250px;
        overflow-y: auto;
        word-wrap: break-word;
      }

      .back-btn {
        margin-top: 25px;
        background: black;
        color: white;
      }

      .copy-msg {
        color: #fff;
        margin-top: 8px;
        font-size: 14px;
        display: none;
      }
    </style>
  </head>
  <body>
    <h2>✏️ AI Description Generator</h2>

    <div class="card">
      <textarea id="videoTitle" placeholder="Enter your video title here..."></textarea>
      <button onclick="generateDescription()">Generate 200-word Description</button>
      <div class="desc-box" id="descResult"></div>
      <button onclick="copyDescription()">Copy Description</button>
      <div class="copy-msg" id="copyMsg">✅ Description Copied!</div>
    </div>

    <button class="back-btn" onclick="window.close()">← Back</button>

<script>
  function generateDescription() {
    const input = document.getElementById("videoTitle").value.trim();
    const resultDiv = document.getElementById("descResult");

    if (!input) {
      resultDiv.innerHTML = "❌ Please enter a title";
      return;
    }

    resultDiv.innerHTML = "⏳ Generating description...";

    setTimeout(() => {
      // Fake AI description for demo purposes (200 words)
      let desc = "";
      for (let i = 1; i <= 40; i++) {
        desc += input + " amazing content 🎉 exciting moments 🚀 fun & entertainment! ";
      }
      resultDiv.innerText = desc.trim();
    }, 1000); // simulates processing delay
  }

  function copyDescription() {
    const descText = document.getElementById("descResult").innerText;
    if (!descText) return;

    navigator.clipboard.writeText(descText).then(() => {
      const msg = document.getElementById("copyMsg");
      msg.style.display = "block";
      setTimeout(() => { msg.style.display = "none"; }, 2000);
    });
  }
</script>
  </body>
  </html>
  `);

  w.document.close();
}
    if (tool === "Tittle") {
  const w = window.open('', '_blank');
  if (!w) {
    alert("Please allow popups!");
    return;
  }

  w.document.write(`
  <html>
  <head>
    <title>AI Title Generator</title>
    <style>
      body {
        font-family: 'Poppins', sans-serif;
        background: linear-gradient(135deg, #ff9966, #ff5e62);
        margin: 0;
        padding: 20px;
        color: white;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      h2 {
        margin-top: 10px;
        text-shadow: 0 2px 6px rgba(0,0,0,0.4);
      }

      .card {
        width: 90%;
        max-width: 500px;
        background: rgba(255,255,255,0.15);
        padding: 18px;
        border-radius: 16px;
        box-shadow: 0 8px 20px rgba(0,0,0,0.25);
        backdrop-filter: blur(6px);
        margin-top: 20px;
        animation: fade 0.4s ease;
      }

      @keyframes fade {
        from { opacity:0; transform:translateY(10px);}
        to { opacity:1; transform:translateY(0);}
      }

      textarea {
        width: 100%;
        padding: 12px;
        border-radius: 8px;
        border: none;
        margin-top: 10px;
        font-size: 15px;
        resize: none;
        height: 80px;
      }

      button {
        width: 100%;
        padding: 12px;
        margin-top: 12px;
        border: none;
        background: #fff;
        color: #ff5e62;
        font-size: 16px;
        border-radius: 10px;
        cursor: pointer;
        font-weight: bold;
      }

      .title-box {
        margin-top: 15px;
        padding: 12px;
        background: rgba(0,0,0,0.25);
        border-radius: 12px;
        font-size: 16px;
        max-height: 150px;
        overflow-y: auto;
        word-wrap: break-word;
      }

      .back-btn {
        margin-top: 25px;
        background: black;
        color: white;
      }

      .copy-msg {
        color: #fff;
        margin-top: 8px;
        font-size: 14px;
        display: none;
      }
    </style>
  </head>
  <body>
    <h2>🔍 AI Title Generator</h2>

    <div class="card">
      <textarea id="videoTopic" placeholder="Enter your video topic or keyword..."></textarea>
      <button onclick="generateTitle()">Generate Catchy Title</button>
      <div class="title-box" id="titleResult"></div>
      <button onclick="copyTitle()">Copy Title</button>
      <div class="copy-msg" id="copyMsg">✅ Title Copied!</div>
    </div>

    <button class="back-btn" onclick="window.close()">← Back</button>

<script>
  function generateTitle() {
    const input = document.getElementById("videoTopic").value.trim();
    const resultDiv = document.getElementById("titleResult");

    if (!input) {
      resultDiv.innerHTML = "❌ Please enter a topic or keyword";
      return;
    }

    resultDiv.innerHTML = "⏳ Generating title...";

    setTimeout(() => {
      // Fake AI catchy title generator (demo)
      const templates = [
        \`Ultimate \${input} Guide 2025! 🚀\`,
        \`Top 10 Secrets About \${input} You Must Know! ✨\`,
        \`\${input} Tips & Tricks for Beginners 🎯\`,
        \`How to Master \${input} Fast! 💡\`,
        \`The Complete \${input} Tutorial 🔥\`
      ];
      const randomIndex = Math.floor(Math.random() * templates.length);
      resultDiv.innerText = templates[randomIndex];
    }, 800);
  }

  function copyTitle() {
    const titleText = document.getElementById("titleResult").innerText;
    if (!titleText) return;

    navigator.clipboard.writeText(titleText).then(() => {
      const msg = document.getElementById("copyMsg");
      msg.style.display = "block";
      setTimeout(() => { msg.style.display = "none"; }, 2000);
    });
  }
</script>
  </body>
  </html>
  `);

  w.document.close();
}
    if (tool === "channel name") {
  const w = window.open('', '_blank');
  if (!w) {
    alert("Please allow popups!");
    return;
  }

  w.document.write(`
  <html>
  <head>
    <title>AI Channel Name Generator</title>
    <style>
      body {
        font-family: 'Poppins', sans-serif;
        background: linear-gradient(135deg, #ff9966, #ff5e62);
        margin: 0;
        padding: 20px;
        color: white;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      h2 {
        margin-top: 10px;
        text-shadow: 0 2px 6px rgba(0,0,0,0.4);
      }

      .card {
        width: 90%;
        max-width: 500px;
        background: rgba(255,255,255,0.15);
        padding: 18px;
        border-radius: 16px;
        box-shadow: 0 8px 20px rgba(0,0,0,0.25);
        backdrop-filter: blur(6px);
        margin-top: 20px;
        animation: fade 0.4s ease;
      }

      @keyframes fade {
        from { opacity:0; transform:translateY(10px);}
        to { opacity:1; transform:translateY(0);}
      }

      input {
        width: 100%;
        padding: 12px;
        border-radius: 8px;
        border: none;
        margin-top: 10px;
        font-size: 15px;
      }

      button {
        width: 100%;
        padding: 12px;
        margin-top: 12px;
        border: none;
        background: #fff;
        color: #ff5e62;
        font-size: 16px;
        border-radius: 10px;
        cursor: pointer;
        font-weight: bold;
      }

      .name-box {
        margin-top: 15px;
        padding: 12px;
        background: rgba(0,0,0,0.25);
        border-radius: 12px;
        font-size: 16px;
        max-height: 200px;
        overflow-y: auto;
        word-wrap: break-word;
      }

      .back-btn {
        margin-top: 25px;
        background: black;
        color: white;
      }

      .copy-msg {
        color: #fff;
        margin-top: 8px;
        font-size: 14px;
        display: none;
      }
    </style>
  </head>
  <body>
    <h2>🎯 AI Channel Name Generator</h2>

    <div class="card">
      <input id="keyword" placeholder="Enter niche or keyword..." />
      <button onclick="generateChannelNames()">Generate Channel Names</button>
      <div class="name-box" id="nameResult"></div>
      <button onclick="copyNames()">Copy All Names</button>
      <div class="copy-msg" id="copyMsg">✅ Names Copied!</div>
    </div>

    <button class="back-btn" onclick="window.close()">← Back</button>

<script>
  function generateChannelNames() {
    const keyword = document.getElementById("keyword").value.trim();
    const resultDiv = document.getElementById("nameResult");

    if (!keyword) {
      resultDiv.innerHTML = "❌ Please enter a keyword";
      return;
    }

    resultDiv.innerHTML = "⏳ Generating names...";

    setTimeout(() => {
      // Simple AI name generator demo
      const suggestions = [
        \`\${keyword} Zone\`,
        \`\${keyword} Hub\`,
        \`The \${keyword} Studio\`,
        \`\${keyword} World\`,
        \`\${keyword} Quest\`,
        \`Ultimate \${keyword}\`,
        \`\${keyword} Central\`,
        \`\${keyword} Lab\`,
        \`\${keyword} Play\`,
        \`\${keyword} Vibes\`
      ];

      resultDiv.innerHTML = suggestions.join(" 🌟\\n");
    }, 800);
  }

  function copyNames() {
    const namesText = document.getElementById("nameResult").innerText;
    if (!namesText) return;

    navigator.clipboard.writeText(namesText).then(() => {
      const msg = document.getElementById("copyMsg");
      msg.style.display = "block";
      setTimeout(() => { msg.style.display = "none"; }, 2000);
    });
  }
</script>
  </body>
  </html>
  `);

  w.document.close();
}
    if (tool === "tags") {
  const w = window.open('', '_blank');
  if (!w) {
    alert("Please allow popups!");
    return;
  }

  w.document.write(`
  <html>
  <head>
    <title>AI Tags Generator</title>
    <style>
      body {
        font-family: 'Poppins', sans-serif;
        background: linear-gradient(135deg, #6a11cb, #2575fc);
        margin: 0;
        padding: 20px;
        color: white;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      h2 {
        margin-top: 10px;
        text-shadow: 0 2px 6px rgba(0,0,0,0.4);
      }

      .card {
        width: 90%;
        max-width: 550px;
        background: rgba(255,255,255,0.15);
        padding: 18px;
        border-radius: 16px;
        box-shadow: 0 8px 20px rgba(0,0,0,0.25);
        backdrop-filter: blur(6px);
        margin-top: 20px;
        animation: fade 0.4s ease;
      }

      @keyframes fade {
        from { opacity:0; transform:translateY(10px);}
        to { opacity:1; transform:translateY(0);}
      }

      input {
        width: 100%;
        padding: 12px;
        border-radius: 8px;
        border: none;
        margin-top: 10px;
        font-size: 15px;
      }

      button {
        width: 100%;
        padding: 12px;
        margin-top: 12px;
        border: none;
        background: #fff;
        color: #2575fc;
        font-size: 16px;
        border-radius: 10px;
        cursor: pointer;
        font-weight: bold;
      }

      .tags-box {
        margin-top: 15px;
        padding: 12px;
        background: rgba(0,0,0,0.25);
        border-radius: 12px;
        font-size: 14px;
        max-height: 250px;
        overflow-y: auto;
        white-space: pre-wrap;
      }

      .back-btn {
        margin-top: 25px;
        background: black;
        color: white;
      }

      .copy-msg {
        color: #fff;
        margin-top: 8px;
        font-size: 14px;
        display: none;
      }
    </style>
  </head>
  <body>
    <h2>🏷️ AI Tags Generator</h2>

    <div class="card">
      <input id="topic" placeholder="Enter video topic or keyword..." />
      <button onclick="generateTags()">Generate Tags</button>
      <div class="tags-box" id="tagsResult"></div>
      <button onclick="copyTags()">Copy Tags</button>
      <div class="copy-msg" id="copyMsg">✅ Tags Copied!</div>
    </div>

    <button class="back-btn" onclick="window.close()">← Back</button>

<script>
  function generateTags() {
    const topic = document.getElementById("topic").value.trim();
    const resultDiv = document.getElementById("tagsResult");

    if (!topic) {
      resultDiv.innerHTML = "❌ Please enter a topic";
      return;
    }

    resultDiv.innerHTML = "⏳ Generating tags...";

    setTimeout(() => {
      // Simple 300-word tags generator demo
      const baseTags = [
        topic, topic + " Gameplay", topic + " Tips", topic + " Tricks",
        topic + " Guide", topic + " Highlights", topic + " Funny Moments",
        topic + " Best Moments", topic + " Live", topic + " Challenges",
        topic + " 2025", topic + " New Update", topic + " Strategy", topic + " Battle",
        topic + " Multiplayer", topic + " Stream", topic + " Mobile", topic + " PC",
        topic + " YouTube", topic + " Video"
      ];

      // Repeat until ~300 words
      let tags = [];
      while(tags.join(", ").split(" ").length < 300) {
        tags = tags.concat(baseTags);
      }

      // Limit to 300 words approx
      let finalTags = tags.join(", ").split(" ").slice(0,300).join(" ");
      finalTags = finalTags.replace(/ ,/g,","); // clean commas

      resultDiv.innerText = finalTags;
    }, 800);
  }

  function copyTags() {
    const tagsText = document.getElementById("tagsResult").innerText;
    if (!tagsText) return;

    navigator.clipboard.writeText(tagsText).then(() => {
      const msg = document.getElementById("copyMsg");
      msg.style.display = "block";
      setTimeout(() => { msg.style.display = "none"; }, 2000);
    });
  }
</script>
  </body>
  </html>
  `);

  w.document.close();
}
    if (tool === "hastag") {
  const w = window.open('', '_blank');
  if (!w) {
    alert("Please allow popups!");
    return;
  }

  w.document.write(`
  <html>
  <head>
    <title>AI Hashtag Generator</title>
    <style>
      body {
        font-family: 'Poppins', sans-serif;
        background: linear-gradient(135deg, #ff9966, #ff5e62);
        margin: 0;
        padding: 20px;
        color: white;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      h2 {
        margin-top: 10px;
        text-shadow: 0 2px 6px rgba(0,0,0,0.4);
      }

      .card {
        width: 90%;
        max-width: 500px;
        background: rgba(255,255,255,0.15);
        padding: 18px;
        border-radius: 16px;
        box-shadow: 0 8px 20px rgba(0,0,0,0.25);
        backdrop-filter: blur(6px);
        margin-top: 20px;
        animation: fade 0.4s ease;
      }

      @keyframes fade {
        from { opacity:0; transform:translateY(10px);}
        to { opacity:1; transform:translateY(0);}
      }

      input {
        width: 100%;
        padding: 12px;
        border-radius: 8px;
        border: none;
        margin-top: 10px;
        font-size: 15px;
      }

      button {
        width: 100%;
        padding: 12px;
        margin-top: 12px;
        border: none;
        background: #fff;
        color: #ff5e62;
        font-size: 16px;
        border-radius: 10px;
        cursor: pointer;
        font-weight: bold;
      }

      .tags-box {
        margin-top: 15px;
        padding: 12px;
        background: rgba(0,0,0,0.25);
        border-radius: 12px;
        font-size: 14px;
        max-height: 150px;
        overflow-y: auto;
        word-wrap: break-word;
      }

      .back-btn {
        margin-top: 25px;
        background: black;
        color: white;
      }

      .copy-msg {
        color: #fff;
        margin-top: 8px;
        font-size: 14px;
        display: none;
      }
    </style>
  </head>
  <body>
    <h2>#️⃣ AI Hashtag Generator</h2>

    <div class="card">
      <input id="topic" placeholder="Enter topic or keyword..." />
      <button onclick="generateHashtags()">Generate Hashtags</button>
      <div class="tags-box" id="tagsResult"></div>
      <button onclick="copyHashtags()">Copy Hashtags</button>
      <div class="copy-msg" id="copyMsg">✅ Hashtags Copied!</div>
    </div>

    <button class="back-btn" onclick="window.close()">← Back</button>

<script>
  function generateHashtags() {
    const topic = document.getElementById("topic").value.trim();
    const resultDiv = document.getElementById("tagsResult");

    if (!topic) {
      resultDiv.innerHTML = "❌ Please enter a topic";
      return;
    }

    resultDiv.innerHTML = "⏳ Generating hashtags...";

    setTimeout(() => {
      // Simple 10 hashtag generator demo
      const hashtags = [
        '#' + topic.replace(/\\s+/g,''),
        '#' + topic.replace(/\\s+/g,'') + 'Game',
        '#' + topic.replace(/\\s+/g,'') + 'Tips',
        '#' + topic.replace(/\\s+/g,'') + 'Fun',
        '#' + topic.replace(/\\s+/g,'') + 'Challenge',
        '#' + topic.replace(/\\s+/g,'') + 'Play',
        '#' + topic.replace(/\\s+/g,'') + 'Video',
        '#' + topic.replace(/\\s+/g,'') + 'Guide',
        '#' + topic.replace(/\\s+/g,'') + 'Highlights',
        '#' + topic.replace(/\\s+/g,'') + 'Vlog'
      ];

      resultDiv.innerText = hashtags.join(", ");
    }, 500);
  }

  function copyHashtags() {
    const tagsText = document.getElementById("tagsResult").innerText;
    if (!tagsText) return;

    navigator.clipboard.writeText(tagsText).then(() => {
      const msg = document.getElementById("copyMsg");
      msg.style.display = "block";
      setTimeout(() => { msg.style.display = "none"; }, 2000);
    });
  }
</script>
  </body>
  </html>
  `);

  w.document.close();
}
    if (tool === "time") {
  const w = window.open('', '_blank');

  if (!w) {
    alert("Please allow popups for this site!");
    return;
  }

w.document.write(`
<html>
<head>
<title>Best Video Posting Time</title>

<style>
  body {
    font-family: Poppins, Arial;
    padding: 20px;
    background: linear-gradient(135deg,#2b2e4a,#24243e,#141e30);
    color: white;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align:center;
  }

  h2 {
    margin-bottom: 20px;
    font-size: 26px;
    font-weight:600;
    letter-spacing:1px;
  }

  select, button {
    padding: 12px;
    width: 270px;
    margin: 12px 0;
    font-size: 16px;
    border-radius: 10px;
    border: none;
    outline: none;
  }

  select {
    background: rgba(255,255,255,0.15);
    color:white;
    backdrop-filter: blur(10px);
    box-shadow: 0 0 10px rgba(255,255,255,0.1);
  }

  button {
    background: linear-gradient(45deg,#6a5af9,#8364ff,#5ac8fa);
    color:white;
    cursor:pointer;
    font-weight:600;
    transition:0.3s;
  }

  button:hover {
    transform: scale(1.05);
    box-shadow:0 0 12px #6a5af9;
  }

  .back-btn {
    margin-top:20px;
    background:rgba(255,255,255,0.2);
    box-shadow:none;
  }

  .card {
    background: rgba(255,255,255,0.08);
    padding: 18px;
    border-radius: 15px;
    margin-top: 20px;
    width: 90%;
    backdrop-filter: blur(10px);
    box-shadow: 0 0 15px rgba(0,0,0,0.4);
    animation: fadeIn 0.4s ease;
  }

  .card h3 {
    margin:0;
    font-size:20px;
    font-weight:600;
  }

  @keyframes fadeIn {
    from { opacity:0; transform: translateY(20px); }
    to   { opacity:1; transform: translateY(0); }
  }
</style>

</head>

<body>

<h2>📊 Best Video Posting Time</h2>

<select id="countrySelect">
  <option value="India">🇮🇳 India</option>
  <option value="USA">🇺🇸 USA</option>
  <option value="UK">🇬🇧 UK</option>
  <option value="Germany">🇩🇪 Germany</option>
  <option value="Pakistan">🇵🇰 Pakistan</option>
  <option value="Brazil">🇧🇷 Brazil</option>
  <option value="Canada">🇨🇦 Canada</option>
  <option value="Australia">🇦🇺 Australia</option>
  <option value="Japan">🇯🇵 Japan</option>
  <option value="France">🇫🇷 France</option>
  <option value="Russia">🇷🇺 Russia</option>
</select>

<select id="categorySelect">
  <option value="Gaming">Gaming</option>
  <option value="Vlogs">Vlogs</option>
  <option value="Music">Music</option>
  <option value="Education">Education</option>
  <option value="Howto & Style">Howto & Style</option>
  <option value="Technology">Technology</option>
  <option value="Sports">Sports</option>
  <option value="Comedy">Comedy</option>
  <option value="News">News</option>
  <option value="Food & Cooking">Food & Cooking</option>
  <option value="Travel">Travel</option>
  <option value="Fashion">Fashion</option>
  <option value="Motivation">Motivation</option>
  <option value="Science">Science</option>
  <option value="Movies">Movies</option>
</select>

<button onclick="getBestTime()">Calculate</button>

<div id="results"></div>

<button class="back-btn" onclick="window.close()">← Back</button>

<script>
const bestTimes = {
  "India": { 
    "Gaming":"18:30","Vlogs":"20:00","Music":"19:00","Education":"17:00",
    "Howto & Style":"16:30","Technology":"18:00","Sports":"17:30","Comedy":"21:00",
    "News":"13:00","Food & Cooking":"16:00","Travel":"19:30","Fashion":"20:30",
    "Motivation":"18:00","Science":"15:30","Movies":"21:00"
  },
  "USA": { 
    "Gaming":"12:00","Vlogs":"14:30","Music":"13:00","Education":"15:00",
    "Howto & Style":"11:30","Technology":"12:30","Sports":"14:00","Comedy":"16:00",
    "News":"10:00","Food & Cooking":"12:00","Travel":"15:00","Fashion":"14:30",
    "Motivation":"13:00","Science":"11:00","Movies":"18:00"
  },
  "UK": { 
    "Gaming":"13:00","Vlogs":"15:30","Music":"14:00","Education":"12:30",
    "Howto & Style":"13:30","Technology":"14:00","Sports":"16:00","Comedy":"17:00",
    "News":"11:30","Food & Cooking":"13:00","Travel":"16:00","Fashion":"15:00",
    "Motivation":"14:00","Science":"12:00","Movies":"20:00"
  },
  "Germany":{ 
    "Gaming":"14:00","Vlogs":"16:30","Music":"15:00","Education":"13:30",
    "Howto & Style":"14:30","Technology":"14:30","Sports":"17:00","Comedy":"18:00",
    "News":"12:00","Food & Cooking":"14:00","Travel":"17:00","Fashion":"16:00",
    "Motivation":"15:00","Science":"13:00","Movies":"20:30"
  },
  "Pakistan":{ 
    "Gaming":"18:00","Vlogs":"20:30","Music":"19:30","Education":"17:30",
    "Howto & Style":"16:00","Technology":"18:30","Sports":"19:00","Comedy":"21:00",
    "News":"14:00","Food & Cooking":"16:30","Travel":"20:00","Fashion":"21:00",
    "Motivation":"18:00","Science":"16:00","Movies":"21:30"
  },
  "Brazil":{ 
    "Gaming":"11:00","Vlogs":"13:30","Music":"12:30","Education":"14:00",
    "Howto & Style":"10:30","Technology":"12:00","Sports":"13:30","Comedy":"15:00",
    "News":"09:00","Food & Cooking":"10:30","Travel":"13:00","Fashion":"12:30",
    "Motivation":"11:30","Science":"10:00","Movies":"18:00"
  },
  "Canada":{ 
    "Gaming":"12:30","Vlogs":"15:00","Music":"13:30","Education":"14:30",
    "Howto & Style":"11:00","Technology":"12:00","Sports":"14:30","Comedy":"16:00",
    "News":"10:00","Food & Cooking":"12:00","Travel":"14:30","Fashion":"15:00",
    "Motivation":"13:00","Science":"11:30","Movies":"19:00"
  },
  "Australia":{ 
    "Gaming":"19:00","Vlogs":"21:30","Music":"20:00","Education":"18:00",
    "Howto & Style":"17:30","Technology":"19:30","Sports":"21:00","Comedy":"22:00",
    "News":"16:00","Food & Cooking":"18:00","Travel":"21:00","Fashion":"22:00",
    "Motivation":"19:30","Science":"17:00","Movies":"22:30"
  },
  "Japan":{ 
    "Gaming":"20:00","Vlogs":"22:30","Music":"21:00","Education":"19:30",
    "Howto & Style":"18:30","Technology":"20:30","Sports":"22:00","Comedy":"23:00",
    "News":"17:00","Food & Cooking":"19:00","Travel":"22:00","Fashion":"23:00",
    "Motivation":"21:00","Science":"18:00","Movies":"23:30"
  },
  "France":{ 
    "Gaming":"13:30","Vlogs":"16:00","Music":"14:30","Education":"12:30",
    "Howto & Style":"13:00","Technology":"14:00","Sports":"16:30","Comedy":"17:30",
    "News":"11:00","Food & Cooking":"13:00","Travel":"16:00","Fashion":"15:30",
    "Motivation":"14:00","Science":"12:30","Movies":"20:30"
  },
  "Russia":{ 
    "Gaming":"19:00","Vlogs":"20:30","Music":"18:30","Education":"17:30",
    "Howto & Style":"16:00","Technology":"18:30","Sports":"20:00","Comedy":"22:00",
    "News":"14:00","Food & Cooking":"16:30","Travel":"20:00","Fashion":"21:00",
    "Motivation":"18:30","Science":"17:00","Movies":"21:30"
  }
};

function getBestTime() {
  const country = document.getElementById('countrySelect').value;
  const category = document.getElementById('categorySelect').value;
  const time = bestTimes[country][category];

  document.getElementById('results').innerHTML =
    '<div class="card"><h3>' + country + ' • ' + category + '</h3>' +
    '<p style="margin-top:10px;font-size:18px;">Best Posting Time: <b>' + time + '</b></p></div>';
}
</script>

</body>
</html>
`);

w.document.close();
return;
}
    });
});
