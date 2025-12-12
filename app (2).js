/*
  app.js — كامل منطق اللعبة مع تصحيح تحميل صورة البازل.
  - يحاول أولاً تحميل الصورة الافتراضية من Google Drive باستخدام رابط UC.
  - إذا فشلت الصورة (غير عامة أو CORS مشكلة) يعرض رسالة ويمكّنك من:
    * لصق رابط مباشر لصورة عامة
    * أو رفع ملف صورة من جهازك (FileReader → dataURL) — هذه تعمل دائماً
  - عند توفر الصورة تُقسم بدقّة إلى قطع باستخدام canvas (سيسمح لنا بقطع الصورة بدقة).
  - إذا منع CORS الرسم إلى canvas عند استخدام رابط خارجي، سيتم التحويل إلى الطريقة البديلة (object-position).
*/

(function(){
  // ------------------ Helpers ------------------
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  function log(msg){ const st = $('#status-log'); if(st) st.textContent = msg; }
  function showScene(id){ $$('.scene').forEach(s=>s.classList.remove('active')); const el = document.getElementById(id); if(el) el.classList.add('active'); log('Scene: '+id); }
  function saveAnswers(){ localStorage.setItem('sou_game_answers', JSON.stringify(state.answers)); log('Answers saved'); }
  function loadAnswers(){ const raw = localStorage.getItem('sou_game_answers'); if(raw){ try{ state.answers = JSON.parse(raw) }catch(e){} } }
  function normalize(t){ return (t||'').toString().trim().toLowerCase().replace(/\s+/g,' '); }

  // ------------------ State ------------------
  const state = {
    answers:{},
    shortQIndex:0,
    shortQs:[ /* same as earlier */ {
      id: 'q1', q: "How long have we known each other?", type: 'choices', choices: ['10','12','13','14'], correct: '13', correctMsg: 'SHATER YA SAFSOFTY 😘', wrongMsg: '…حزين / غاضب 😢'
    },{
      id:'q2', q: "Do you remember how we met?", type: 'text', correctMsg: 'You remembered? 😊', wrongMsg: 'You forgot? 😢'
    },{
      id:'q3', q: "What was your first impression of me?", type:'text'
    },{
      id:'q4', q: "What is my birthdate?", type:'text', correctAnswers: ['20/7/2005','20-7-2005','20 7 2005','20 july 2005','20 july,2005','20/07/2005'], correctMsg: 'Correct! 🎉', wrongMsg: 'I expected you to know that…'
    },{
      id:'q5', q: "What is my favorite food?", type:'text'
    },{
      id:'q6', q: "What is my favorite drink?", type:'text'
    }],
    deepQs: [ /* 14 questions (kept as before) */ 
      "What reminds you of me the most?",
      "One trait of mine you really like?",
      "One trait of mine you don’t like and wish I could change?",
      "If we could go back in time, would you want to meet me in the same place or somewhere new?",
      "What’s the thing we are most different in?",
      "When you’re upset… what’s the best way you like me to make it up to you?",
      "Place you’d love us to visit together someday?",
      "One thing I could do to make you say yes to whatever I ask?",
      "Thing that shows you my love for you?",
      "Your love language?",
      "If you could repeat one day we spent together, which day?",
      "If you could change one thing that happened to us, what?",
      "Your favorite memory of us?",
      "Any question for me?"
    ],
    maze:{ rows:10, cols:10, grid:[], start:{r:8,c:1}, end:{r:1,c:8} },
    locks: [
      {q:"If I were you, would I choose Burger or Pizza?", choices:['Burger','Pizza'], correct:'pizza'},
      {q:"If I’m sad, would I sit alone or in the group?", choices:['Alone','Group'], correct:'alone'},
      {q:"If I have free time, would I draw or listen to music?", choices:['Draw','Listen to music'], correct:'draw'},
      {q:"If I’m watching the sky, would I choose Sunset or Sunrise?", choices:['Sunset','Sunrise'], correct:'sunrise'}
    ],
    // puzzle state
    puzzle: {
      size: 3,        // 3x3
      pieces: [],     // pieces array when generated
      solved: false,
      imageSrc: ''    // current image source (dataURL or remote)
    }
  };

  loadAnswers();

  // ------------------ Basic flow (start/kiss/short questions/describe/fav/maze/locks/hug/deep/wish) ----------
  // For brevity these functions mirror previous version: render questions, maze, locks etc.
  // Only puzzle code is expanded below; the rest is kept functional and concise.

  $('#startBtn').addEventListener('click', ()=> { $('#bubble-start').innerHTML = `HEY BABEE! HERE'S YOUR FAV MANON<br><small class="muted">"I made this game just for you..."</small>`; showScene('kiss'); });
  $('#readyBtn').addEventListener('click', ()=>{
    const av = $('#avatar-kiss'); $('#bubble-kiss').textContent = `Wait… take a kiss first 😘`; if(av) av.classList.add('kiss');
    setTimeout(()=>{ if(av) av.classList.remove('kiss'); showScene('short-questions'); initShortQuestions(); }, 2200);
  });

  // Short questions (same logic as earlier)
  function initShortQuestions(){ state.shortQIndex = 0; renderShortQuestion(); $('#sq-skip').onclick = ()=> handleShortAnswer(null,true); }
  function renderShortQuestion(){
    const idx = state.shortQIndex, q = state.shortQs[idx];
    $('#sq-counter').textContent = `سؤال ${idx+1} من ${state.shortQs.length}`;
    const area = $('#sq-content'); area.innerHTML = '';
    const qh = document.createElement('div'); qh.style.fontWeight='700'; qh.style.marginBottom='8px'; qh.textContent = q.q; area.appendChild(qh);
    if(q.type === 'choices'){
      const opts = document.createElement('div'); opts.className='options';
      q.choices.forEach(choice=>{ const b=document.createElement('div'); b.className='option'; b.textContent=choice; b.onclick=()=>handleShortAnswer(choice,false); opts.appendChild(b); });
      area.appendChild(opts);
    } else {
      const input = document.createElement('input'); input.type='text'; input.placeholder='Type your answer...'; area.appendChild(input);
      const btn = document.createElement('button'); btn.className='small'; btn.textContent='Submit'; btn.onclick = ()=> handleShortAnswer(input.value,false);
      const wrap = document.createElement('div'); wrap.style.marginTop='8px'; wrap.appendChild(btn); area.appendChild(wrap);
    }
    $('#sq-next').style.display='none';
  }

  function handleShortAnswer(answer, skipped){
    const idx = state.shortQIndex, q = state.shortQs[idx], bubble = $('#bubble-sq');
    if(skipped){ bubble.textContent = "Skipped…"; state.answers[q.id]=""; } else {
      state.answers[q.id] = answer;
      if(q.type === 'choices'){
        if(String(answer) === String(q.correct)){ bubble.textContent = q.correctMsg || 'Correct!'; }
        else { bubble.textContent = q.wrongMsg || 'Wrong 😢'; }
      } else {
        if(q.id==='q4'){ const ok = (q.correctAnswers||[]).some(c => normalize(c) === normalize(answer)); bubble.textContent = ok ? (q.correctMsg||'Correct!') : (q.wrongMsg||'Hmm…'); }
        else bubble.textContent = q.correctMsg || 'Thanks!';
      }
    }
    saveAnswers();
    $('#sq-next').style.display='inline-block';
    $('#sq-next').onclick = ()=>{
      state.shortQIndex++;
      if(state.shortQIndex >= state.shortQs.length){ $('#bubble-sq').innerHTML = `Mmm… looks like you know me well 😳<br><small class="muted">Just one more thing left to move to the next level.</small>`; saveAnswers(); setTimeout(()=> showScene('describe'), 1200); }
      else renderShortQuestion();
    };
  }

  $('#desc-next').addEventListener('click', ()=> { state.answers.describe = $('#desc-input').value || ''; saveAnswers(); showScene('favorite-person'); });
  $('#desc-skip').addEventListener('click', ()=> { state.answers.describe = ''; saveAnswers(); showScene('favorite-person'); });

  $('#start-maze').addEventListener('click', ()=> { $('#boy-card').style.opacity='0.12'; $('#bubble-fav').textContent = "My heart is broken… he's far away 😢"; setTimeout(()=>{ showScene('maze-scene'); initMaze(); }, 800); });

  // Maze (same simple implementation)
  function buildMazeGrid(){
    const r = state.maze.rows, c = state.maze.cols;
    const g = new Array(r).fill(0).map(()=> new Array(c).fill(1));
    for(let i=0;i<r;i++) for(let j=0;j<c;j++) g[i][j] = (Math.random()>0.28?0:1);
    g[state.maze.start.r][state.maze.start.c]=0; g[state.maze.end.r][state.maze.end.c]=0;
    // carve direct corridor
    let sr=state.maze.start.r, sc=state.maze.start.c, er=state.maze.end.r, ec=state.maze.end.c;
    let rdir = sr<er?1:-1; for(let rr=sr; rr!==er; rr+=rdir) g[rr][sc]=0;
    let cdir = sc<ec?1:-1; for(let cc=sc; cc!==ec; cc+=cdir) g[er][cc]=0;
    for(let dr=-1; dr<=1; dr++) for(let dc=-1; dc<=1; dc++){ const rr=Math.max(0,Math.min(r-1,er+dr)); const cc=Math.max(0,Math.min(c-1,ec+dc)); g[rr][cc]=0; }
    return g;
  }
  let playerPos = {};
  function initMaze(){ state.maze.grid = buildMazeGrid(); playerPos = {r:state.maze.start.r, c:state.maze.start.c}; renderMaze();
    $('#maze-log').textContent = "Use arrows or buttons to move. Reach the girl!";
    $('#up').onclick = ()=> movePlayer(-1,0); $('#down').onclick = ()=> movePlayer(1,0); $('#left').onclick = ()=> movePlayer(0,-1); $('#right').onclick = ()=> movePlayer(0,1);
    $('#reset-maze').onclick = ()=> initMaze();
    window.onkeydown = (e)=>{ if(!document.getElementById('maze-scene').classList.contains('active')) return; const k=e.key; if(k==='ArrowUp') movePlayer(-1,0); if(k==='ArrowDown') movePlayer(1,0); if(k==='ArrowLeft') movePlayer(0,-1); if(k==='ArrowRight') movePlayer(0,1); };
  }
  function renderMaze(){ const mazeEl = $('#maze'); mazeEl.innerHTML=''; const g=state.maze.grid;
    for(let i=0;i<state.maze.rows;i++) for(let j=0;j<state.maze.cols;j++){ const cell=document.createElement('div'); cell.className='cell '+(g[i][j]?'wall':''); if(i===playerPos.r && j===playerPos.c){ cell.classList.add('player'); cell.textContent='🙂'; } else if(i===state.maze.end.r && j===state.maze.end.c){ cell.classList.add('goal'); cell.textContent='👩'; } mazeEl.appendChild(cell); }
  }
  function movePlayer(dr,dc){ const nr=playerPos.r+dr, nc=playerPos.c+dc; if(nr<0||nr>=state.maze.rows||nc<0||nc>=state.maze.cols) return; if(state.maze.grid[nr][nc]===1){ $('#maze-log').textContent = "Ouch! There's a wall."; return; } playerPos={r:nr,c:nc}; renderMaze(); $('#maze-log').textContent = `Position: ${nr},${nc}`; if(nr===state.maze.end.r && nc===state.maze.end.c){ $('#bubble-maze').textContent = "Yay! We made it 😘"; setTimeout(()=>{ showScene('door-locks'); initLocks(); }, 1000); } }

  // Locks
  function initLocks(){ const area = $('#lock-q-area'); area.innerHTML=''; state.locks.forEach((lock, idx)=>{ const card=document.createElement('div'); card.style.background='var(--glass)'; card.style.padding='10px'; card.style.borderRadius='8px'; const qh=document.createElement('div'); qh.style.fontWeight='700'; qh.textContent=lock.q; card.appendChild(qh); const opts=document.createElement('div'); opts.className='options'; lock.choices.forEach(ch=>{ const b=document.createElement('div'); b.className='option'; b.textContent=ch; b.onclick=()=>handleLockAnswer(idx,ch); opts.appendChild(b); }); card.appendChild(opts); area.appendChild(card); }); updateLocksUI(); }
  function handleLockAnswer(idx, choice){ const lock=state.locks[idx], key=`lock_${idx}`; if(normalize(choice)===normalize(lock.correct)){ state.answers[key]=choice; document.getElementById('lock'+(idx+1)).classList.add('open'); document.getElementById('lock'+(idx+1)).textContent='🔓'; $('#bubble-locks').textContent='Nice! Lock opened 😊'; } else { state.answers[key]=choice; $('#bubble-locks').textContent='Wrong… 😢'; const el=document.getElementById('lock'+(idx+1)); el.classList.add('wrong-temp'); setTimeout(()=>el.classList.remove('wrong-temp'),700); } saveAnswers(); updateLocksUI(); }
  function updateLocksUI(){ const allOpen = state.locks.every((l,i)=> normalize(state.answers[`lock_${i}`]||'') === normalize(l.correct)); $('#try-door').disabled = !allOpen; if(allOpen) $('#bubble-locks').textContent="All locks are open!"; }
  $('#try-door').addEventListener('click', ()=>{ $('#bubble-locks').textContent = 'I’m here for you, baby 😘'; setTimeout(()=> showScene('hug'), 800); });

  // Hug -> Deep
  $('#start-deep').addEventListener('click', ()=>{ $('#p-boy').classList.add('holding'); $('#p-girl').classList.add('holding'); setTimeout(()=>{ $('#p-boy').classList.remove('holding'); $('#p-girl').classList.remove('holding'); showScene('deep'); initDeep(); }, 900); });

  function initDeep(){ const area = $('#deep-q-area'); area.innerHTML=''; state.deepQs.forEach((q,idx)=>{ const card=document.createElement('div'); card.style.background='var(--glass)'; card.style.padding='8px'; card.style.borderRadius='8px'; const qh=document.createElement('div'); qh.style.fontWeight='700'; qh.textContent = `${idx+1}. ${q}`; card.appendChild(qh); const ta = document.createElement('textarea'); ta.rows=2; ta.placeholder='Type your answer...'; const key=`deep_${idx}`; if(state.answers[key]) ta.value = state.answers[key]; ta.onchange = ()=>{ state.answers[key]=ta.value; saveAnswers(); }; card.appendChild(ta); const sm = document.createElement('div'); sm.style.display='flex'; sm.style.justifyContent='space-between'; sm.style.marginTop='6px'; const skip = document.createElement('button'); skip.className='small skip'; skip.textContent='Skip'; skip.onclick = ()=>{ ta.value=''; state.answers[key]=''; saveAnswers(); }; sm.appendChild(skip); card.appendChild(sm); area.appendChild(card); }); }

  $('#deep-next').addEventListener('click', ()=>{ saveAnswers(); showScene('wish'); });
  $('#deep-skip').addEventListener('click', ()=>{ for(let i=0;i<state.deepQs.length;i++) state.answers['deep_'+i]=''; saveAnswers(); showScene('wish'); });

  // ---------- Puzzle: robust image loading & slicing ----------
  // Default Drive uc link (from user): if it's public this may work.
  const DEFAULT_DRIVE_UC = 'https://drive.google.com/uc?export=view&id=1hs4ub9FR4dgoOaNtfZS_k0joTm-hTVqn';

  // UI references
  const puzzleArea = () => $('#puzzle-area');
  const puzzleMsg = () => $('#puzzle-msg');
  const imgError = () => $('#img-error');

  // utility: load image from src (URL or dataURL). returns Promise<Image>
  function loadImage(src, allowCrossOrigin=true){
    return new Promise((resolve, reject)=>{
      const img = new Image();
      if(allowCrossOrigin) img.crossOrigin = 'Anonymous'; // request CORS for canvas
      img.onload = ()=> resolve(img);
      img.onerror = (e)=> reject(new Error('Image failed to load: '+src));
      img.src = src;
      // If cached image might be blocked by CORS, onerror will trigger.
    });
  }

  // Try to init puzzle with given src. Attempt canvas slicing first; if canvas blocked by CORS, fallback.
  async function initPuzzleWithImage(src){
    puzzleMsg().textContent = 'Loading image…';
    imgError().textContent = '';
    state.puzzle.imageSrc = src;
    // Clear area
    puzzleArea().innerHTML = '';

    try{
      // Try to load with CORS to enable canvas slicing
      const img = await loadImage(src, true);
      // attempt canvas draw to test CORS access
      try {
        // draw to a temporary canvas to ensure no taint
        const testCanvas = document.createElement('canvas');
        testCanvas.width = img.naturalWidth;
        testCanvas.height = img.naturalHeight;
        const testCtx = testCanvas.getContext('2d');
        testCtx.drawImage(img,0,0);
        // try reading pixel to be sure
        testCanvas.toDataURL('image/png');
        // success — now slice into pieces using canvas
        buildPuzzlePiecesFromImage(img);
        puzzleMsg().textContent = 'Image loaded and sliced.';
        return;
      } catch(cErr){
        // CORS blocked toDataURL — fallback to object-position slicing (less accurate but shows image)
        console.warn('Canvas toDataURL blocked (CORS). Falling back to object-position method.', cErr);
        buildPuzzlePiecesFallback(src);
        puzzleMsg().textContent = 'Image loaded (fallback). If you need perfect slices, upload the image file instead.';
        return;
      }
    } catch(err){
      console.warn('Load with CORS failed, trying without CORS...', err);
      // try loading without crossOrigin (some servers block crossOrigin but still allow image display)
      try{
        const imgNoCors = await loadImage(src, false);
        // still cannot use canvas safely -> fallback object-position
        buildPuzzlePiecesFallback(src);
        puzzleMsg().textContent = 'Image loaded (fallback). If you want precise slicing, upload the image file.';
        return;
      } catch(err2){
        // final failure -> show helpful message and let user upload or provide another URL
        imgError().textContent = 'الصورة لم تُحمّل: الرجاء التأكد أن الملف عام (Anyone with link) أو ارفعي صورة من جهازك أو الصقي رابط مباشر لصورة.';
        puzzleArea().innerHTML = '';
        puzzleMsg().textContent = '';
        console.error('Image load failed entirely', err2);
        return;
      }
    }
  }

  // Build real slices using canvas (best quality) — img is loaded and CORS-permitted
  function buildPuzzlePiecesFromImage(img){
    const size = state.puzzle.size;
    const rows = size, cols = size;
    const w = img.naturalWidth, h = img.naturalHeight;
    const pieceW = Math.floor(w / cols), pieceH = Math.floor(h / rows);
    // Normalize puzzle area size to square or responsive: we'll create images for pieces sized by container later
    state.puzzle.pieces = [];
    // create each piece dataURL
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const sx = c * pieceW, sy = r * pieceH;
        const canvas = document.createElement('canvas');
        canvas.width = pieceW; canvas.height = pieceH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, pieceW, pieceH, 0, 0, pieceW, pieceH);
        const dataURL = canvas.toDataURL('image/png');
        const piece = { orig: r*cols + c, pos: r*cols + c, src: dataURL };
        state.puzzle.pieces.push(piece);
      }
    }
    renderPuzzlePieces();
    shufflePuzzle();
  }

  // Fallback building: use same image for all pieces and object-position to simulate cropping
  function buildPuzzlePiecesFallback(src){
    const size = state.puzzle.size;
    const rows = size, cols = size;
    state.puzzle.pieces = [];
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const idx = r*cols + c;
        const piece = { orig: idx, pos: idx, src: src, r, c };
        state.puzzle.pieces.push(piece);
      }
    }
    renderPuzzlePieces(true); // pass fallback flag
    shufflePuzzle();
  }

  // Render pieces into DOM. If fallback==true, pieces use <img> with object-position to show slice.
  function renderPuzzlePieces(fallback=false){
    const area = puzzleArea();
    area.innerHTML = '';
    const size = state.puzzle.size, rows=size, cols=size;
    // create elements according to current pieces' pos order
    const byPos = [...state.puzzle.pieces].sort((a,b)=> Number(a.pos)-Number(b.pos));
    byPos.forEach(p=>{
      const div = document.createElement('div');
      div.className = 'piece';
      div.draggable = true;
      div.dataset.orig = p.orig;
      div.dataset.pos = p.pos;
      // content
      const img = document.createElement('img');
      img.alt = 'piece';
      if(!fallback && p.src && p.src.startsWith('data:')) {
        img.src = p.src; // dataURL slice
      } else if(fallback){
        // Use full image with object-position to emulate cropping
        img.src = p.src;
        // compute object-position based on r,c
        const posX = (p.c/(cols-1))*100;
        const posY = (p.r/(rows-1))*100;
        img.style.width = (cols*100) + '%';
        img.style.height = (rows*100) + '%';
        img.style.objectFit = 'cover';
        img.style.objectPosition = `${posX}% ${posY}%`;
      } else {
        // If src is a remote URL but we couldn't slice, fallback to it directly (not cropped)
        img.src = p.src;
      }
      div.appendChild(img);

      // drag/drop
      div.addEventListener('dragstart', e=>{
        e.dataTransfer.setData('text/plain', div.dataset.pos);
        setTimeout(()=> div.classList.add('hidden'), 50);
      });
      div.addEventListener('dragend', e=> div.classList.remove('hidden'));
      div.addEventListener('dragover', e=> e.preventDefault());
      div.addEventListener('drop', e=>{
        e.preventDefault();
        const from = e.dataTransfer.getData('text/plain');
        const to = div.dataset.pos;
        swapPieces(from,to);
        renderPuzzlePieces(fallback);
        checkPuzzleSolved(true);
      });

      area.appendChild(div);
    });
  }

  function shufflePuzzle(){
    const positions = state.puzzle.pieces.map(p=>p.pos);
    for(let i=positions.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    state.puzzle.pieces.forEach((p, idx)=> { p.pos = positions[idx]; });
    renderPuzzlePieces();
  }

  function swapPieces(fromPos, toPos){
    fromPos = Number(fromPos); toPos = Number(toPos);
    const a = state.puzzle.pieces.find(p=>Number(p.pos)===fromPos);
    const b = state.puzzle.pieces.find(p=>Number(p.pos)===toPos);
    if(!a || !b) return;
    const ta = a.pos; a.pos = b.pos; b.pos = ta;
  }

  function checkPuzzleSolved(showMessage){
    const ok = state.puzzle.pieces.every(p => Number(p.pos) === Number(p.orig));
    if(ok){
      state.puzzle.solved = true;
      if(showMessage) puzzleMsg().textContent = "All our memories… just for you 😘";
      $$('[data-orig]').forEach(el=> el.classList.add('completed'));
      return true;
    } else {
      if(showMessage) puzzleMsg().textContent = "Not complete yet, keep trying.";
      return false;
    }
  }

  // UI: buttons for puzzle image selection
  $('#start-puzzle').addEventListener('click', ()=>{ showScene('puzzle'); // set default image url input value to DEFAULT
    $('#image-url').value = DEFAULT_DRIVE_UC;
    // Try to auto-load default image
    initPuzzleWithImage(DEFAULT_DRIVE_UC);
  });

  $('#use-url').addEventListener('click', ()=> {
    const url = $('#image-url').value.trim();
    if(!url){ $('#img-error').textContent = 'الصقي رابط صورة مباشر أولاً.'; return; }
    initPuzzleWithImage(url);
  });

  $('#upload-file').addEventListener('change', (e)=>{
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = (ev)=>{
      const dataURL = ev.target.result;
      // DataURL can be sliced with canvas — no CORS problem
      initPuzzleWithImage(dataURL);
    };
    reader.readAsDataURL(f);
  });

  $('#shuffle').addEventListener('click', ()=> { shufflePuzzle(); puzzleMsg().textContent = 'Shuffled!'; });
  $('#check-puzzle').addEventListener('click', ()=> { if(checkPuzzleSolved(true)){ puzzleMsg().textContent='All our memories… just for you 😘'; } });
  $('#reset-puzzle').addEventListener('click', ()=> { puzzleArea().innerHTML=''; puzzleMsg().textContent='Image reset. Paste a URL or upload again.'; imgError().textContent=''; $('#image-url').value=''; state.puzzle.pieces=[]; state.puzzle.imageSrc=''; });

  // ------------------ Initialization ------------------
  showScene('start');
  window.sou = { state, saveAnswers };
  console.log('Game ready. If the Drive image does not appear, make sure file is shared "Anyone with the link (Viewer)" or upload the image file directly.');
})();
