/* Metal Extraction Quest II — game.js
 * S3 Chemistry · Lesson 18: Rocks and minerals I (metal extraction)
 * Chemistry frozen against: s3_Lesson 18_rocks-minerals-i_metal-extraction_studio.html
 * Sections:
 *   1. Utilities + i18n + frozen chemistry data + quiz banks
 *   2. Audio (procedural WebAudio)
 *   3. World generation + textures + meshing
 *   4. Renderer, lighting, sky, environment dressing
 *   5. Stations, labels, beacon, particles
 *   6. Player, camera, movement, mining, combat
 *   7. HUD, inventory, minimap, mission pad
 *   8. Extraction UI, reactivity ladder, discovery timeline, crafting
 *   9. Boss fight + win/lose + teacher report
 *  10. Input (keyboard/mouse/touch), main loop, boot
 */
window.__startMetalQuest = function (THREE) {
'use strict';

/* ============================================================
 * 0. Utilities
 * ============================================================ */
var lang = 'en';
function L(pair) {
  if (pair == null) return '';
  if (typeof pair === 'string') return pair;
  return pair[lang] != null ? pair[lang] : (pair.en != null ? pair.en : '');
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function $(id) { return document.getElementById(id); }

/* Seeded RNG so textures/world details are stable per session build */
function makeRng(seed) {
  var s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ============================================================
 * 1. Frozen chemistry (Lesson 18 studio) — do not edit casually
 * ============================================================ */
var CHEM = {
  eq: {
    ironWord:   { en: 'iron(III) oxide + carbon monoxide → iron + carbon dioxide',
                  zh: '氧化鐵(III) + 一氧化碳 → 鐵 + 二氧化碳' },
    iron:       'Fe₂O₃ + 3CO → 2Fe + 3CO₂',
    cokeBurn:   'C + O₂ → CO₂',
    makeCO:     'CO₂ + C → 2CO',
    limeDecomp: 'CaCO₃ → CaO + CO₂',
    slag:       'CaO + SiO₂ → CaSiO₃',
    copperWord: { en: 'copper(II) oxide + carbon → copper + carbon dioxide',
                  zh: '氧化銅(II) + 碳 → 銅 + 二氧化碳' },
    copper:     '2CuO + C → 2Cu + CO₂',
    silverWord: { en: 'silver oxide → silver + oxygen',
                  zh: '氧化銀 → 銀 + 氧氣' },
    silver:     '2Ag₂O → 4Ag + O₂',
    alWord:     { en: 'aluminium oxide → aluminium + oxygen (electrolysis)',
                  zh: '氧化鋁 → 鋁 + 氧氣（電解）' },
    al:         '2Al₂O₃ → 4Al + 3O₂'
  },
  /* Blast furnace zones, top → bottom (shown during iron extraction) */
  zones: [
    { ico: '🌬️',
      where: { en: 'Bottom: hot air is blasted in over coke', zh: '底部：熱空氣鼓入焦炭' },
      eq: 'C + O₂ → CO₂',
      note: { en: 'coke burns — supplies the heat', zh: '焦炭燃燒——提供熱量' } },
    { ico: '💨',
      where: { en: 'CO₂ rises over more hot coke', zh: 'CO₂ 上升經過更多熾熱焦炭' },
      eq: 'CO₂ + C → 2CO',
      note: { en: 'makes the reducing agent CO', zh: '製造還原劑 CO' } },
    { ico: '🔥',
      where: { en: 'Middle: CO meets haematite — THE key reaction', zh: '中部：CO 遇到赤鐵礦——最關鍵反應' },
      eq: 'Fe₂O₃ + 3CO → 2Fe + 3CO₂',
      note: { en: 'CO removes oxygen from the ore', zh: 'CO 把氧從礦石中除去' } },
    { ico: '🪨',
      where: { en: 'Limestone decomposes, then removes sand', zh: '石灰石分解，然後除去泥沙' },
      eq: 'CaCO₃ → CaO + CO₂   ·   CaO + SiO₂ → CaSiO₃',
      note: { en: 'calcium silicate slag floats on the iron', zh: '矽酸鈣爐渣浮在鐵水上面' } }
  ],
  /* Reactivity ladder, most reactive first */
  ladder: [
    { el: 'K',  full: { en: 'Potassium', zh: '鉀' } },
    { el: 'Na', full: { en: 'Sodium', zh: '鈉' } },
    { el: 'Ca', full: { en: 'Calcium', zh: '鈣' } },
    { el: 'Al', full: { en: 'Aluminium', zh: '鋁' }, metal: 'al', method: 'electro' },
    { el: 'C',  full: { en: 'Carbon', zh: '碳' }, carbonLine: true },
    { el: 'Zn', full: { en: 'Zinc', zh: '鋅' } },
    { el: 'Fe', full: { en: 'Iron', zh: '鐵' }, metal: 'fe', method: 'carbon' },
    { el: 'Sn', full: { en: 'Tin', zh: '錫' } },
    { el: 'Pb', full: { en: 'Lead', zh: '鉛' } },
    { el: 'H',  full: { en: 'Hydrogen', zh: '氫' } },
    { el: 'Cu', full: { en: 'Copper', zh: '銅' }, metal: 'cu', method: 'carbon' },
    { el: 'Hg', full: { en: 'Mercury', zh: '汞' } },
    { el: 'Ag', full: { en: 'Silver', zh: '銀' }, metal: 'silver', method: 'heat' },
    { el: 'Au', full: { en: 'Gold', zh: '金' }, metal: 'gold', method: 'free' }
  ],
  /* Discovery cards — correct order index = discovery order */
  cards: [
    { id: 'gold', el: 'Au', ico: '🟡', order: 0,
      name: { en: 'Gold', zh: '金' },
      era: { en: 'Ancient — found as FREE metal', zh: '遠古——以游離金屬發現' },
      hint: { en: 'Needs no extraction at all', zh: '完全不需要提取' } },
    { id: 'copper', el: 'Cu', ico: '🔶', order: 1,
      name: { en: 'Copper', zh: '銅' },
      era: { en: '~6,000 years ago — first ore smelted with charcoal', zh: '約6000年前——首個用木炭冶煉的礦石' },
      hint: { en: 'Below carbon → carbon works', zh: '在碳之下→用碳便可' } },
    { id: 'silver', el: 'Ag', ico: '⚪', order: 2,
      name: { en: 'Silver', zh: '銀' },
      era: { en: '~5,000 years ago — oxide breaks down on heating', zh: '約5000年前——氧化物受熱便分解' },
      hint: { en: 'Very unreactive → heat alone', zh: '非常不活潑→單靠加熱' } },
    { id: 'iron', el: 'Fe', ico: '⚙️', order: 3,
      name: { en: 'Iron', zh: '鐵' },
      era: { en: '~3,500 years ago — needs a very hot furnace + carbon', zh: '約3500年前——需要高溫爐＋碳' },
      hint: { en: 'Needs a hotter furnace than copper', zh: '需要比銅更高溫的爐' } },
    { id: 'aluminium', el: 'Al', ico: '🔩', order: 4,
      name: { en: 'Aluminium', zh: '鋁' },
      era: { en: '1825 — only after electricity was understood', zh: '1825年——直到人類認識電之後' },
      hint: { en: 'Above carbon → electrolysis only', zh: '在碳之上→只能電解' } }
  ]
};

/* ============================================================
 * 2. i18n — UI chrome strings
 * ============================================================ */
var I18N = {
  en: {
    title: 'Metal Extraction Quest II',
    intro: 'S3 chemistry adventure: mine ores, run a real blast furnace, electrolyse aluminium, craft weapons and defeat the Ore Beast. Every station follows the Lesson 18 chemistry.',
    howTitle: 'How metals are extracted (remember this!)',
    rule1: "A metal's <b>position in the reactivity series</b> decides the method.",
    rule2: '<b>Below carbon</b> (Fe, Cu…) → heat the ore with <b>carbon / carbon monoxide</b>.',
    rule3: '<b>Above carbon</b> (Al…) → only <b>electrolysis</b> (electricity) works.',
    rule4: '<b>Very unreactive</b> (Ag, Hg) → oxides break down on <b>heating alone</b>; Au is found <b>free</b>.',
    controlsTitle: 'Controls',
    ctrlPC: '<b>PC:</b> WASD move · mouse look · left-click mine · E stations · 1–6 weapons · RMB bow aim',
    ctrlTouch: '<b>iPad / touch:</b> left joystick · drag right side to look · Mine / Use / Jump / Sprint buttons',
    modeTitle: 'Difficulty',
    relaxed: '🌿 Relaxed lab', relaxedDesc: 'Wrong answers cost HP + time. Good for first play.',
    standard: '⚔️ Standard', standardDesc: 'No armour = one wrong boss answer defeats you.',
    startGame: 'Start Game',
    libReadyPC: 'Ready — PC controls or touch. Click Start Game!',
    libReadyTouch: 'Ready for iPad/touch — tap Start Game (joystick + buttons will appear)',
    bestTime: 'Best time so far: {t}',
    newRecord: '🏆 New best time!',
    missionTime: 'Mission time', labMission: 'LAB MISSION', mapTitle: 'WORLD MAP',
    materials: 'Materials (count)', weapons: 'Weapons (tap to equip)',
    aimHint: 'Aiming — Shoot (or left click) · Aim again to cancel',
    dragLook: 'Drag here to look',
    aim: 'Aim', shoot: 'Shoot', sprint: 'Sprint', jump: 'Jump', useKey: 'E Use', mine: 'Mine',
    ladderBtn: 'Reactivity', soundBtn: 'Sound',
    oreBeast: 'Ore Beast', yourHp: 'Your HP',
    bagTitle: '1. Your bag — click to put into the reactor',
    reactorTitle: '2. Reactor (put the correct blocks here)',
    predictTitle: '3. Predict before heating', predictHint: 'Choose one answer, then click Heat.',
    explainTitle: '4. Explain what happened',
    heatBtn: 'Heat / Extract', clearReactor: 'Clear reactor', close: 'Close',
    readyHeat: 'Ready — put materials in, then heat',
    anvilTitle: 'Crafting Anvil',
    anvilIntro: 'Weapons from Cu/Fe/Ag/Au. Al armour is optional — on Standard, without it a wrong boss answer is instant defeat.',
    ladderTitle: 'The Reactivity Ladder',
    ladderIntro: "The one rule of metal extraction: a metal's position in the reactivity series decides how it is extracted. Green = metals you have already produced.",
    tag_electro: '⚡ electrolysis only', tag_carbon: '🔥 carbon / CO', tag_heat: '🌡️ heat alone', tag_free: '✨ found free',
    carbonLine: '— metals BELOW this line can be reduced by carbon / CO —',
    tlTitle: 'Discovery Timeline',
    tlIntro: 'Collect metal cards as you meet each metal. Then place them in order of discovery — earliest first.',
    tlCheck: 'Check order', tlClear: 'Reset',
    tl_locked: 'Card not found yet — keep playing!',
    tl_needAll: 'Place all five cards first.',
    tl_wrong: 'Not yet — green cards are in the right place. Think: harder to extract → discovered later?',
    tl_right: '✅ Perfect! The more reactive the metal, the harder it is to extract — and the later humans discovered it.',
    tl_reward: '+2 ⚡ electricity reward!',
    tl_cardGot: '📜 Metal card collected: {m} — visit the stone monument!',
    gateTitle: 'Boss Gate', enterBoss: 'Enter Boss Arena',
    gate_ready_armour: 'Ready! Weapon + Al armour equipped. Wrong answers hurt less. Answer chemistry questions in 10 s.',
    gate_ready_noarmour: 'You can enter with a weapon only — but WITHOUT armour, one wrong answer defeats you instantly (Standard). Craft Al armour if you can!',
    gate_locked: 'Boss locked. Craft at least one weapon at the anvil first. (Al armour is optional but strongly recommended.)',
    dodgeTitle: 'Ore Beast attacks — answer in time!',
    dodgeHint_relaxed: '10 seconds · Correct = dodge + heal · Wrong = −12 HP + 10 s on mission timer',
    dodgeHint_std_noarmour: '10 seconds · Correct = dodge + heal · Wrong = INSTANT DEFEAT (no armour!) + 10 s',
    dodgeHint_std_armour: '10 seconds · Correct = dodge + heal · Wrong = −12 HP + 10 s on mission timer',
    winTitle: 'Victory!', clearTime: 'Clear time',
    recapTitle: 'Chemistry recap (S3 · Lesson 18)',
    nseTitle: '🇨🇳 Reflection: rare earth elements',
    nseText: 'Modern phones, EVs and wind turbines need rare earth elements — and China holds a large share of the world\'s supply. Like aluminium once was, these metals are hard to extract and strategically important. Discussion: why does controlling rare metals matter to a country?',
    exitTicket: 'Exit ticket:',
    exitTicketQ: 'In the blast furnace, which substance removes oxygen from haematite?',
    exit_ok: 'Excellent — carbon monoxide does the reducing: Fe₂O₃ + 3CO → 2Fe + 3CO₂. That is the key S3 idea!',
    exit_err: 'Try again: coke makes heat and CO, limestone makes slag — CO removes the oxygen.',
    teacherReport: 'Teacher report', copyReport: '📋 Copy report for OneNote',
    copied: 'Copied!', copyFail: 'Copy failed — select the text manually.',
    playAgain: 'Play Again',
    loseTitle: 'Defeated!',
    loseText: 'On Standard, without aluminium armour one wrong answer defeats you. Craft Al armour (electrolysis cell → Al metal → anvil) and try again. Inventory is kept; the timer keeps running.',
    returnWorld: 'Return to World',
    /* objectives */
    obj_wood: 'Mission: chop WOOD in the south forest 🌲',
    obj_kiln: 'Mission: burn wood at the KILN → carbon (charcoal)',
    obj_ores: 'Mission: mine HAEMATITE (west, red rock) + LIMESTONE (north-west, pale rock)',
    obj_furnace: 'Mission: BLAST FURNACE — haematite + carbon + limestone → iron',
    obj_copper: 'Mission: COPPER WORKS — copper ore + carbon → copper',
    obj_power: 'Mission: POWER GENERATOR — burn carbon → ⚡ electricity',
    obj_bauxite: 'Mission: mine BAUXITE (east edges, reddish rock) for aluminium',
    obj_cell: 'Mission: ELECTROLYSIS CELL — bauxite + ⚡ → aluminium',
    obj_weapon: 'Mission: craft a WEAPON at the anvil to unlock the boss',
    obj_armourOpt: 'Boss unlocked! Optional: craft Al armour (Standard: no armour = 1 wrong = KO)',
    obj_bossReady: 'Boss unlocked with armour — head north to the gate. Wrong answers still cost +10 s.',
    obj_boss: 'Ore Beast! Melee LMB · Bow: RMB aim then LMB shoot · answer quizzes in 10 s',
    /* stations */
    st_kiln: 'Press E — Charcoal Kiln (wood → carbon)',
    st_furnace: 'Press E — Blast Furnace (haematite + carbon + limestone)',
    st_copper: 'Press E — Copper Works (Cu extract / Ag₂O heat)',
    st_generator: 'Press E — Power Generator (carbon → ⚡)',
    st_cell: 'Press E — Electrolysis Cell (bauxite + ⚡ → Al)',
    st_craft: 'Press E — Anvil (weapons + Al armour)',
    st_monument: 'Press E — Discovery Monument (timeline puzzle)',
    st_boss: 'Press E — Boss Gate',
    /* block labels */
    lb_haematite: 'Haematite Fe₂O₃ (red-brown) — blast furnace',
    lb_copper: 'Copper ore CuO (green) — needs carbon',
    lb_limestone: 'Limestone CaCO₃ — removes impurities as slag',
    lb_bauxite: 'Bauxite (Al ore) — electrolysis cell + ⚡',
    lb_ag: 'Silver oxide Ag₂O — heat to get silver',
    lb_gold: 'Gold — FREE pure metal! craft directly',
    lb_wood: 'Wood → burn at kiln for carbon',
    lb_stone: 'Stone', lb_dirt: 'Dirt / grass', lb_path: 'Path', lb_bedrock: 'Bedrock (unbreakable)',
    /* mining toasts */
    t_haematite: '+1 Haematite (Fe₂O₃) — blast furnace needs it',
    t_copper: '+1 Copper ore — extract with carbon at Copper Works',
    t_limestone: '+1 Limestone — removes sandy impurities as slag',
    t_bauxite: '+1 Bauxite (Al ore) — electrolysis cell needs ⚡',
    t_ag: '+1 Silver oxide (Ag₂O) — heat at Copper Works to get silver',
    t_gold: '+1 Gold! FREE pure metal — craft weapons directly (no extraction)',
    t_wood: '+1 Wood — burn at the kiln!',
    bedrockMsg: 'Bedrock cannot be mined',
    /* generic */
    notEnough: 'Not enough {m}', reactorFull: 'Reactor is full — remove a block first',
    needPowerFirst: 'The cell needs ⚡ electricity — burn carbon at the Power Generator first',
    weaponEquipped: '{w} equipped', noWeapon: 'No weapon', armourLabel: '🛡️ Al armour ON',
    craftOk: 'Clang! Crafted {q}{w}!', armourOn: '🛡️ Aluminium armour on! Wrong answers no longer one-hit KO.',
    bossTooFar: 'Too far — walk closer, then left-click to swing',
    missed: 'Missed — too far', arrowHit: 'Arrow hit −{d} HP', arrowFired: 'Arrow fired!',
    aimOnlyBoss: 'Aim only in boss fight with a bow equipped',
    equipBowFirst: 'Equip a bow (1–6) first',
    aimToastPC: 'Aiming — left click to shoot', aimToastTouch: 'Aiming — tap Shoot',
    holdRMB: 'Hold RIGHT-CLICK to aim bow, LEFT-CLICK to shoot',
    equipMelee: 'Equip a sword/knife (1–6)',
    timerStarted: 'Timer started. Wrong answers +10 s. Weapon unlocks boss!',
    dragLookToast: 'Embedded mode: DRAG on the world to look around · CLICK to mine · E to use stations',
    touchToast: 'Touch: joystick move · drag right to look · Mine / Use buttons',
    cameraReset: 'Camera pitch reset',
    waitHeat: 'Wait for heating to finish!', finishExplain: 'Finish the explain step before closing!',
    finishBonus: 'Answer the bonus question first!',
    bonusRight: '✅ Bonus correct! +1 ⚡ electricity', bonusMiss: 'Bonus missed (+10 s). Product already collected.',
    masteredNote: 'You already mastered this process — heat freely. Bonus questions may appear on repeats.',
    firstNote: 'First time: put blocks → predict → heat → explain. Later heats skip the same questions.',
    predGood: 'Good prediction — now click Heat!',
    predSaved: 'Prediction saved — heat and see if you were right.',
    predictionRequired: 'First time on this process — make a <b>prediction</b>, then heat.',
    matsNotEnough: 'Not enough materials in bag.', needMore: 'Need more {m} (in bag).',
    whyFailed: 'Why it failed:', matsKept: 'Materials were not used up.',
    heatingWrong: 'Heating… something is wrong…', tryingHeat: '🔥 Trying to heat — watch what fails…',
    heatingOk: '🔥 Heating… {p}',
    predMatch: 'Your prediction matches the expected product.', predWatch: 'Watch carefully to check your prediction.',
    predMastered: 'Mastered process — running freely.',
    doneGot: 'Done! Got {o}', slagToo: ' (slag tapped off too!)',
    explainOk: '✅ Good explanation! You will not see the same questions again for this process.',
    explainErr: 'Not quite — read the formula strip and try again. (+10 s)',
    wrongPen: '{r} · +10 s',
    chooseFurnace: 'Pick a furnace process, then load the reactor.',
    chooseCopper: 'Choose a process below',
    furnaceInfo: 'Charge in at the TOP (haematite + coke + limestone) · hot air blasted at the bottom · molten iron + slag tapped at the base.',
    copperInfo: 'Mining digs rocks up. Extraction turns compounds into metal.',
    missionWood: 'Got wood', missionCarbon: 'Made carbon (kiln)', missionOres: 'Mined haematite + limestone',
    missionIron: 'Extracted iron (blast furnace)', missionCopper: 'Extracted copper',
    missionPower: 'Made ⚡ electricity', missionAl: 'Extracted aluminium (electrolysis)',
    missionSilver: 'Extracted silver (Ag₂O heat)', missionWeapon: 'Crafted a weapon (unlock boss)',
    missionArmour: 'Al armour (survive hits)', missionTL: 'Discovery timeline (bonus)',
    missionBoss: 'Defeated Ore Beast',
    legend: '🟥Fe west · 🟩Cu east · ⬜limestone NW · 🌲wood S · 🟪boss N',
    rep_title: 'Metal Extraction Quest II — student report',
    rep_date: 'Date', rep_mode: 'Mode', rep_time: 'Clear time', rep_pen: 'Time penalties',
    rep_failed: 'Failed heats', rep_wrong: 'Wrong answers', rep_none: '(none)',
    rep_mastered: 'Mastered processes', rep_armour: 'Al armour', rep_tl: 'Timeline solved',
    rep_yes: 'yes', rep_no: 'no', rep_correct: 'correct',
    winStatsArmour: 'wearing Al armour', winStatsNoArmour: 'with no armour (risky!)',
    winStats: 'You defeated the Ore Beast with <b>{w}</b> ({h} hits), {a}.',
    elapsedPen: 'Elapsed with penalties: {t}{p}',
    includesPen: ' (includes +{n}s from wrong answers)', noPen: ' (no time penalties)',
    labStats: 'Lab stats: failed heats {f} · boss correct {c} / wrong {w} · armour {a}',
    yes: 'yes', no: 'no'
  },
  zh: {
    title: '金屬提取大冒險 II',
    intro: '中三化學冒險：開採礦石、運作真正的高爐、電解鋁、製造武器並擊敗礦石巨獸。每個工作站均依照第18課的化學內容。',
    howTitle: '如何提取金屬（記住這個！）',
    rule1: '金屬在<b>活動性順序</b>中的位置決定提取方法。',
    rule2: '<b>碳以下</b>的金屬（Fe、Cu…）→ 用<b>碳／一氧化碳</b>加熱礦石。',
    rule3: '<b>碳以上</b>的金屬（Al…）→ 只有<b>電解</b>（電力）可行。',
    rule4: '<b>非常不活潑</b>的金屬（Ag、Hg）→ 氧化物<b>單靠加熱</b>便分解；Au 以<b>游離態</b>存在。',
    controlsTitle: '操作',
    ctrlPC: '<b>電腦：</b>WASD移動 · 滑鼠轉向 · 左鍵挖掘 · E鍵使用工作站 · 1–6武器 · 右鍵瞄準弓箭',
    ctrlTouch: '<b>iPad／觸控：</b>左搖桿移動 · 右側拖曳轉向 · 挖掘／使用／跳／疾跑按鈕',
    modeTitle: '難度',
    relaxed: '🌿 輕鬆實驗模式', relaxedDesc: '答錯扣HP＋時間，適合初次遊玩。',
    standard: '⚔️ 標準模式', standardDesc: '沒有盔甲時，Boss題答錯一次即敗。',
    startGame: '開始遊戲',
    libReadyPC: '準備就緒——按「開始遊戲」！',
    libReadyTouch: 'iPad／觸控準備就緒——點「開始遊戲」（搖桿＋按鈕會出現）',
    bestTime: '目前最佳時間：{t}',
    newRecord: '🏆 新紀錄！',
    missionTime: '任務時間', labMission: '實驗任務', mapTitle: '世界地圖',
    materials: '材料（數量）', weapons: '武器（點按裝備）',
    aimHint: '瞄準中——按射擊（或左鍵）· 再按一次取消',
    dragLook: '在此拖曳轉向',
    aim: '瞄準', shoot: '射擊', sprint: '疾跑', jump: '跳', useKey: 'E 使用', mine: '挖掘',
    ladderBtn: '活動性', soundBtn: '聲音',
    oreBeast: '礦石巨獸', yourHp: '你的HP',
    bagTitle: '1. 你的背包——點按放入反應器',
    reactorTitle: '2. 反應器（把正確的方塊放這裏）',
    predictTitle: '3. 加熱前先預測', predictHint: '選擇一個答案，然後按加熱。',
    explainTitle: '4. 解釋發生了甚麼',
    heatBtn: '🔥 加熱／提取', clearReactor: '清空反應器', close: '關閉',
    readyHeat: '準備好——放入材料，然後加熱',
    anvilTitle: '鍛造鐵砧',
    anvilIntro: '用Cu/Fe/Ag/Au造武器。鋁盔甲可選——標準模式下沒有盔甲，答錯Boss題即敗。',
    ladderTitle: '活動性階梯',
    ladderIntro: '金屬提取的唯一法則：金屬在活動性順序中的位置決定提取方法。綠色＝你已製出的金屬。',
    tag_electro: '⚡ 只能電解', tag_carbon: '🔥 碳／CO', tag_heat: '🌡️ 單靠加熱', tag_free: '✨ 游離態',
    carbonLine: '— 此線以下的金屬可被碳／CO還原 —',
    tlTitle: '發現時間線',
    tlIntro: '遇到每種金屬時收集金屬卡，然後按發現年份排序——最早的排最前。',
    tlCheck: '檢查順序', tlClear: '重設',
    tl_locked: '尚未找到這張卡——繼續遊戲！',
    tl_needAll: '请先放置五張卡。',
    tl_wrong: '還未對——綠色的卡位置正確。想一想：越難提取→越晚被發現？',
    tl_right: '✅ 完美！金屬越活潑，越難提取——人類也越晚發現它。',
    tl_reward: '獎勵 +2 ⚡ 電力！',
    tl_cardGot: '📜 收集到金屬卡：{m}——到石碑看看！',
    gateTitle: 'Boss之門', enterBoss: '進入Boss戰場',
    gate_ready_armour: '準備好！武器＋鋁盔甲已裝備。答錯傷害較輕。10秒內回答化學題。',
    gate_ready_noarmour: '只帶武器也可進入——但沒有盔甲時，答錯一次即敗（標準模式）。可以的話先造鋁盔甲！',
    gate_locked: 'Boss未解鎖。先到鐵砧製造至少一件武器。（鋁盔甲可選但強烈建議。）',
    dodgeTitle: '礦石巨獸攻擊——限時作答！',
    dodgeHint_relaxed: '10秒 · 答對＝閃避＋治療 · 答錯＝−12 HP＋計時+10秒',
    dodgeHint_std_noarmour: '10秒 · 答對＝閃避＋治療 · 答錯＝即時戰敗（沒有盔甲！）＋計時+10秒',
    dodgeHint_std_armour: '10秒 · 答對＝閃避＋治療 · 答錯＝−12 HP＋計時+10秒',
    winTitle: '勝利！', clearTime: '完成時間',
    recapTitle: '化學溫習（中三 · 第18課）',
    nseTitle: '🇨🇳 思考：稀土元素',
    nseText: '手機、電動車和風力發電機都需要稀土元素——中國佔全球供應的很大份額。稀土就像當年的鋁一樣難以提取，而且具戰略重要性。討論：為甚麼掌控稀有金屬對國家很重要？',
    exitTicket: '離場券：',
    exitTicketQ: '在高爐中，哪種物質把氧從赤鐵礦中除去？',
    exit_ok: '很好——一氧化碳負責還原：Fe₂O₃ + 3CO → 2Fe + 3CO₂。這正是中三的重點！',
    exit_err: '再想：焦炭提供熱能和CO，石灰石造爐渣——除去氧的是CO。',
    teacherReport: '教師報告', copyReport: '📋 複製報告到OneNote',
    copied: '已複製！', copyFail: '複製失敗——請手動選取文字。',
    playAgain: '再玩一次',
    loseTitle: '戰敗！',
    loseText: '標準模式下沒有鋁盔甲，答錯一次即敗。造鋁盔甲（電解池→鋁→鐵砧）再試。背包保留，計時繼續。',
    returnWorld: '返回世界',
    obj_wood: '任務：到南面森林砍木材 🌲',
    obj_kiln: '任務：在炭窯把木材燒成碳（木炭）',
    obj_ores: '任務：開採赤鐵礦（西面，紅棕色）＋石灰石（西北，淺色）',
    obj_furnace: '任務：高爐——赤鐵礦＋碳＋石灰石 → 鐵',
    obj_copper: '任務：煉銅工場——銅礦＋碳 → 銅',
    obj_power: '任務：發電機——燒碳 → ⚡ 電力',
    obj_bauxite: '任務：開採鋁土礦（東面邊緣，紅棕色）',
    obj_cell: '任務：電解池——鋁土礦＋⚡ → 鋁',
    obj_weapon: '任務：到鐵砧造武器，解鎖Boss',
    obj_armourOpt: 'Boss已解鎖！可選：造鋁盔甲（標準模式：無盔甲＝答錯一次即敗）',
    obj_bossReady: '已裝備盔甲，Boss已解鎖——向北到門口。答錯仍會+10秒。',
    obj_boss: '礦石巨獸！近戰按左鍵 · 弓：右鍵瞄準後左鍵射擊 · 10秒內作答',
    st_kiln: '按E——炭窯（木材→碳）',
    st_furnace: '按E——高爐（赤鐵礦＋碳＋石灰石）',
    st_copper: '按E——煉銅工場（提取Cu／加熱Ag₂O）',
    st_generator: '按E——發電機（碳→⚡）',
    st_cell: '按E——電解池（鋁土礦＋⚡→鋁）',
    st_craft: '按E——鐵砧（武器＋鋁盔甲）',
    st_monument: '按E——發現石碑（時間線拼圖）',
    st_boss: '按E——Boss之門',
    lb_haematite: '赤鐵礦 Fe₂O₃（紅棕色）——高爐用',
    lb_copper: '銅礦 CuO（綠色）——需要碳',
    lb_limestone: '石灰石 CaCO₃——除去雜質成爐渣',
    lb_bauxite: '鋁土礦（鋁礦石）——電解池＋⚡',
    lb_ag: '氧化銀 Ag₂O——加熱得銀',
    lb_gold: '金——游離純金屬！直接造武器',
    lb_wood: '木材→到炭窯燒成碳',
    lb_stone: '石頭', lb_dirt: '泥土／草', lb_path: '小徑', lb_bedrock: '基岩（不可破壞）',
    t_haematite: '+1 赤鐵礦（Fe₂O₃）——高爐需要',
    t_copper: '+1 銅礦——到煉銅工場用碳提取',
    t_limestone: '+1 石灰石——除去泥沙雜質成爐渣',
    t_bauxite: '+1 鋁土礦（鋁礦石）——電解池需要⚡',
    t_ag: '+1 氧化銀（Ag₂O）——到煉銅工場加熱得銀',
    t_gold: '+1 金！游離純金屬——直接造武器（不用提取）',
    t_wood: '+1 木材——到炭窯燒掉！',
    bedrockMsg: '基岩不能挖掘',
    notEnough: '{m}不足', reactorFull: '反應器滿了——先移除一個方塊',
    needPowerFirst: '電解池需要⚡電力——先到發電機燒碳',
    weaponEquipped: '已裝備{w}', noWeapon: '沒有武器', armourLabel: '🛡️ 鋁盔甲開啟',
    craftOk: '噹！造出{q}{w}！', armourOn: '🛡️ 鋁盔甲穿上！答錯不再一擊即敗。',
    bossTooFar: '太遠——走近一點再按左鍵揮擊',
    missed: '落空——太遠', arrowHit: '箭命中 −{d} HP', arrowFired: '箭已射出！',
    aimOnlyBoss: '只能在Boss戰裝備弓時瞄準',
    equipBowFirst: '先裝備弓（1–6）',
    aimToastPC: '瞄準中——左鍵射擊', aimToastTouch: '瞄準中——點「射擊」',
    holdRMB: '按住右鍵瞄準弓，左鍵射擊',
    equipMelee: '裝備劍／刀（1–6）',
    timerStarted: '計時開始。答錯+10秒。武器解鎖Boss！',
    dragLookToast: '嵌入模式：在世界拖曳以轉向 · 點擊挖掘 · 按E使用工作站',
    touchToast: '觸控：搖桿移動 · 右側拖曳轉向 · 挖掘／使用按鈕',
    cameraReset: '鏡頭角度已重設',
    waitHeat: '等待加熱完成！', finishExplain: '先完成解釋步驟！',
    finishBonus: '先回答獎勵題！',
    bonusRight: '✅ 獎勵題答對！+1 ⚡ 電力', bonusMiss: '獎勵題答錯（+10秒）。產品已收集。',
    masteredNote: '此流程已熟練——可自由加熱。重複時或會出現獎勵題。',
    firstNote: '首次：放方塊→預測→加熱→解釋。之後加熱不會重複相同問題。',
    predGood: '預測很好——現在按加熱！',
    predSaved: '預測已儲存——加熱看看是否正確。',
    predictionRequired: '首次使用此流程——請先<b>預測</b>，再加熱。',
    matsNotEnough: '背包材料不足。', needMore: '需要更多{m}（在背包）。',
    whyFailed: '失敗原因：', matsKept: '材料未被消耗。',
    heatingWrong: '加熱中……好像不對勁……', tryingHeat: '🔥 嘗試加熱——看看會怎樣失敗……',
    heatingOk: '🔥 加熱中……{p}',
    predMatch: '你的預測與預期產品相符。', predWatch: '仔細觀察以核對你的預測。',
    predMastered: '已熟練的流程——自由運作。',
    doneGot: '完成！獲得{o}', slagToo: '（爐渣也放出來了！）',
    explainOk: '✅ 解釋得對！此流程不會再出現相同問題。',
    explainErr: '未對——看看化學式欄再試。（+10秒）',
    wrongPen: '{r} · +10秒',
    chooseFurnace: '選擇高爐流程，然後裝載反應器。',
    chooseCopper: '選擇以下流程',
    furnaceInfo: '爐料從頂部加入（赤鐵礦＋焦炭＋石灰石）· 熱風從底部鼓入 · 鐵水與爐渣從底部放出。',
    copperInfo: '採礦是挖出岩石；提取是把化合物變成金屬。',
    missionWood: '取得木材', missionCarbon: '製出碳（炭窯）', missionOres: '開採赤鐵礦＋石灰石',
    missionIron: '提取了鐵（高爐）', missionCopper: '提取了銅',
    missionPower: '製出⚡電力', missionAl: '提取了鋁（電解）',
    missionSilver: '提取了銀（加熱Ag₂O）', missionWeapon: '造了武器（解鎖Boss）',
    missionArmour: '鋁盔甲（抵擋攻擊）', missionTL: '發現時間線（獎勵）',
    missionBoss: '擊敗礦石巨獸',
    legend: '🟥鐵西 · 🟩銅東 · ⬜石灰石西北 · 🌲木材南 · 🟪Boss北',
    rep_title: '金屬提取大冒險 II — 學生報告',
    rep_date: '日期', rep_mode: '模式', rep_time: '完成時間', rep_pen: '時間懲罰',
    rep_failed: '失敗加熱', rep_wrong: '答錯題目', rep_none: '（沒有）',
    rep_mastered: '已熟練流程', rep_armour: '鋁盔甲', rep_tl: '時間線完成',
    rep_yes: '有', rep_no: '沒有', rep_correct: '正確',
    winStatsArmour: '穿著鋁盔甲', winStatsNoArmour: '沒有盔甲（冒險！）',
    winStats: '你用<b>{w}</b>（{h}次攻擊）擊敗了礦石巨獸，{a}。',
    elapsedPen: '連懲罰總時間：{t}{p}',
    includesPen: '（包括答錯的+{n}秒）', noPen: '（沒有時間懲罰）',
    labStats: '實驗統計：失敗加熱{f}次 · Boss答對{c}／答錯{w} · 盔甲{a}',
    yes: '有', no: '沒有'
  }
};
function t(key, params) {
  var s = (I18N[lang] && I18N[lang][key]) || (I18N.en[key] != null ? I18N.en[key] : key);
  if (params) {
    Object.keys(params).forEach(function (k) {
      s = s.replace('{' + k + '}', params[k]);
    });
  }
  return s;
}
function applyStaticI18n() {
  var els = document.querySelectorAll('[data-i18n]');
  var i, el, key;
  for (i = 0; i < els.length; i++) {
    el = els[i];
    key = el.getAttribute('data-i18n');
    el.innerHTML = t(key);
  }
  var b = $('btnLang');
  if (b) b.textContent = lang === 'en' ? '中文' : 'EN';
  var ml = $('minimapLegend');
  if (ml) ml.textContent = t('legend');
}

/* Boss quiz bank (SOW-aligned; answer index always shuffled at render time) */
var BOSS_QUESTIONS = [
  { q: { en: 'What is the key difference between mining and metal extraction?',
         zh: '採礦和金屬提取的主要分別是甚麼？' },
    opts: { en: ['Mining digs up ores; extraction turns the compounds into pure metal',
                 'They mean exactly the same thing',
                 'Mining happens after extraction'],
            zh: ['採礦是挖出礦石；提取是把化合物變成純金屬',
                 '兩者完全一樣',
                 '採礦在提取之後發生'] }, a: 0 },
  { q: { en: 'In the blast furnace, the MAIN substance that reduces haematite is…',
         zh: '在高爐中，還原赤鐵礦的主要物質是……' },
    opts: { en: ['Carbon monoxide', 'Coke (carbon)', 'Limestone', 'Oxygen in the hot air'],
            zh: ['一氧化碳', '焦炭（碳）', '石灰石', '熱風中的氧氣'] }, a: 0 },
  { q: { en: 'Fe₂O₃ + ?CO → 2Fe + 3CO₂ — the coefficient of CO is…',
         zh: 'Fe₂O₃ + ?CO → 2Fe + 3CO₂——CO的係數是……' },
    opts: { en: ['3', '1', '2', '4'], zh: ['3', '1', '2', '4'] }, a: 0 },
  { q: { en: 'What job does limestone do in the blast furnace?',
         zh: '石灰石在高爐中做甚麼工作？' },
    opts: { en: ['Removes sandy impurities as slag', 'Reduces the ore to iron', 'Makes carbon monoxide', 'Cools the furnace'],
            zh: ['除去泥沙雜質成爐渣', '把礦石還原成鐵', '製造一氧化碳', '冷卻高爐'] }, a: 0 },
  { q: { en: 'Coke burns in the hot air, then CO₂ reacts with more coke to make…',
         zh: '焦炭在熱風中燃燒，然後CO₂與更多焦炭反應生成……' },
    opts: { en: ['Carbon monoxide (CO₂ + C → 2CO)', 'More limestone', 'Aluminium', 'Water'],
            zh: ['一氧化碳（CO₂ + C → 2CO）', '更多石灰石', '鋁', '水'] }, a: 0 },
  { q: { en: 'Why can gold be used directly after mining?',
         zh: '為甚麼金開採後可直接使用？' },
    opts: { en: ['It is found as free pure metal in nature', 'It is always an oxide that needs carbon', 'It is a gas'],
            zh: ['自然界中它以游離純金屬存在', '它總是需要碳的氧化物', '它是氣體'] }, a: 0 },
  { q: { en: 'Why can silver oxide NOT be used as metal until heated?',
         zh: '為甚麼氧化銀要加熱後才能當作金屬使用？' },
    opts: { en: ['It is a compound (oxide), not free metal', 'It is already pure gold', 'It is only wood'],
            zh: ['它是化合物（氧化物），不是游離金屬', '它已是純金', '它只是木材'] }, a: 0 },
  { q: { en: 'Which balanced equation is correct for heating silver oxide?',
         zh: '加熱氧化銀的正確平衡方程式是哪個？' },
    opts: { en: ['2Ag₂O → 4Ag + O₂', 'Ag₂O → Ag + O₂', '2Ag₂O → 2Ag + O₂'],
            zh: ['2Ag₂O → 4Ag + O₂', 'Ag₂O → Ag + O₂', '2Ag₂O → 2Ag + O₂'] }, a: 0 },
  { q: { en: 'Which pair is correct? Different metals need different methods.',
         zh: '哪組配對正確？不同金屬需要不同方法。' },
    opts: { en: ['Fe/Cu: carbon or CO · Al: electrolysis · Ag₂O: heat alone',
                 'All metals only need water',
                 'All metals are free pure gold'],
            zh: ['Fe/Cu：碳或CO · Al：電解 · Ag₂O：單靠加熱',
                 '所有金屬只需要水',
                 '所有金屬都是游離的純金'] }, a: 0 },
  { q: { en: 'Word equation for copper extraction is…',
         zh: '提取銅的文字方程式是……' },
    opts: { en: ['copper(II) oxide + carbon → copper + carbon dioxide',
                 'copper + oxygen → copper oxide only',
                 'gold → copper + carbon'],
            zh: ['氧化銅(II)＋碳→銅＋二氧化碳',
                 '只有銅＋氧→氧化銅',
                 '金→銅＋碳'] }, a: 0 },
  { q: { en: 'Which balanced equation is correct for copper oxide + carbon?',
         zh: '氧化銅＋碳的正確平衡方程式是哪個？' },
    opts: { en: ['2CuO + C → 2Cu + CO₂', 'CuO + C → 2Cu + CO₂', '2CuO + C → Cu + CO₂'],
            zh: ['2CuO + C → 2Cu + CO₂', 'CuO + C → 2Cu + CO₂', '2CuO + C → Cu + CO₂'] }, a: 0 },
  { q: { en: 'Why is aluminium oxide dissolved in molten cryolite before electrolysis?',
         zh: '為甚麼電解前把氧化鋁溶於熔融冰晶石？' },
    opts: { en: ['It lowers the melting point and saves energy', 'Cryolite is the aluminium ore', 'It makes aluminium more reactive', 'It removes impurities as slag'],
            zh: ['降低熔點、節省能量', '冰晶石就是鋁礦石', '令鋁更活潑', '除去雜質成爐渣'] }, a: 0 },
  { q: { en: 'Which balanced equation is for electrolysis of aluminium oxide?',
         zh: '電解氧化鋁的平衡方程式是哪個？' },
    opts: { en: ['2Al₂O₃ → 4Al + 3O₂', 'Al₂O₃ → Al + O₂', '2Al₂O₃ → 2Al + O₂'],
            zh: ['2Al₂O₃ → 4Al + 3O₂', 'Al₂O₃ → Al + O₂', '2Al₂O₃ → 2Al + O₂'] }, a: 0 },
  { q: { en: 'A metal ABOVE carbon in the reactivity series (e.g. Al) is extracted by…',
         zh: '活動性順序中碳以上的金屬（如鋁）用哪種方法提取？' },
    opts: { en: ['Electrolysis', 'Heating with carbon', 'Heating alone', 'Just mining it'],
            zh: ['電解', '與碳加熱', '單靠加熱', '直接開採'] }, a: 0 },
  { q: { en: 'Which metal was discovered LAST, and why?',
         zh: '哪種金屬最晚被發現？為甚麼？' },
    opts: { en: ['Aluminium — most reactive, needs electrolysis (1825)',
                 'Gold — it hides underground',
                 'Copper — it is rare'],
            zh: ['鋁——最活潑，需要電解（1825年）',
                 '金——它躲在地底',
                 '銅——它很稀有'] }, a: 0 },
  { q: { en: 'The later a metal was discovered in history, usually the…',
         zh: '歷史上越晚被發現的金屬，通常……' },
    opts: { en: ['More reactive it is and harder to extract',
                 'Less reactive it is',
                 'More gold it contains'],
            zh: ['越活潑、越難提取',
                 '越不活潑',
                 '含金越多'] }, a: 0 },
  { q: { en: 'Molten iron collects at the bottom of the furnace. Slag…',
         zh: '鐵水沉在高爐底部。爐渣……' },
    opts: { en: ['Floats on top of the molten iron and is tapped off',
                 'Sinks below the iron',
                 'Turns into gold'],
            zh: ['浮在鐵水上面並被放出',
                 '沉在鐵下面',
                 '變成金'] }, a: 0 },
  { q: { en: 'Which is haematite?',
         zh: '哪一個是赤鐵礦？' },
    opts: { en: ['iron(III) oxide, Fe₂O₃', 'iron(II) oxide, FeO only', 'pure iron metal'],
            zh: ['氧化鐵(III)，Fe₂O₃', '只有氧化鐵(II)，FeO', '純鐵金屬'] }, a: 0 },
  { q: { en: 'Without aluminium armour on Standard, a wrong boss answer will…',
         zh: '標準模式下沒有鋁盔甲，答錯Boss題會……' },
    opts: { en: ['Defeat you in one hit', 'Give free gold', 'Heal you fully'],
            zh: ['一擊即敗', '免費獲得金', '完全治療'] }, a: 0 }
];

/* Win-screen recap lines */
var RECAP = {
  en: [
    '<b>Reactivity decides the method:</b> below carbon → carbon/CO · above carbon → electrolysis · very unreactive → heat alone or free.',
    '<b>Blast furnace charge:</b> haematite + coke + limestone in at the top; hot air blasted near the bottom.',
    '<b>Key reaction:</b> carbon monoxide reduces haematite: Fe₂O₃ + 3CO → 2Fe + 3CO₂.',
    '<b>CO is made inside:</b> C + O₂ → CO₂, then CO₂ + C → 2CO. Coke supplies heat AND makes CO.',
    '<b>Limestone cleans:</b> CaCO₃ → CaO + CO₂, then CaO + SiO₂ → CaSiO₃ slag. Slag does NOT reduce the ore.',
    '<b>Copper:</b> 2CuO + C → 2Cu + CO₂.',
    '<b>Silver oxide decomposes on heating:</b> 2Ag₂O → 4Ag + O₂. Gold is found FREE — no extraction needed.',
    '<b>Aluminium:</b> electrolysis of Al₂O₃ in molten cryolite (lower melting point → saves energy): 2Al₂O₃ → 4Al + 3O₂.',
    '<b>History:</b> the more reactive the metal, the harder the extraction, the later it was discovered (Al only in 1825!).'
  ],
  zh: [
    '<b>活動性決定方法：</b>碳以下→碳／CO · 碳以上→電解 · 非常不活潑→單靠加熱或游離態。',
    '<b>高爐爐料：</b>赤鐵礦＋焦炭＋石灰石從頂部加入；熱風從近底部鼓入。',
    '<b>關鍵反應：</b>一氧化碳還原赤鐵礦：Fe₂O₃ + 3CO → 2Fe + 3CO₂。',
    '<b>CO在爐內製造：</b>C + O₂ → CO₂，然後 CO₂ + C → 2CO。焦炭提供熱能又製造CO。',
    '<b>石灰石負責清潔：</b>CaCO₃ → CaO + CO₂，然後 CaO + SiO₂ → CaSiO₃ 爐渣。爐渣不會還原礦石。',
    '<b>銅：</b>2CuO + C → 2Cu + CO₂。',
    '<b>氧化銀受熱分解：</b>2Ag₂O → 4Ag + O₂。金以游離態存在——不需提取。',
    '<b>鋁：</b>把Al₂O₃溶於熔融冰晶石再電解（降低熔點→節省能量）：2Al₂O₃ → 4Al + 3O₂。',
    '<b>歷史：</b>金屬越活潑，越難提取，越晚被發現（鋁到1825年才發現！）。'
  ]
};

/* ============================================================
 * 3. Procedural audio — zero external files
 * ============================================================ */
var SND = {
  ctx: null, master: null, muted: false, noiseBuf: null,
  roarGain: null, humGain: null, ambientOn: false,
  ensure: function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(this.ctx.destination);
    var len = Math.floor(1.5 * this.ctx.sampleRate);
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var d = this.noiseBuf.getChannelData(0), i;
    for (i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return this.ctx;
  },
  setMuted: function (m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.85;
  },
  tone: function (freq, dur, type, vol, slideTo, delay) {
    var ctx = this.ensure();
    if (!ctx) return;
    var t0 = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.03);
  },
  noise: function (dur, f0, f1, vol, type, delay) {
    var ctx = this.ensure();
    if (!ctx || !this.noiseBuf) return;
    var t0 = ctx.currentTime + (delay || 0);
    var src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    var filt = ctx.createBiquadFilter();
    filt.type = type || 'lowpass';
    filt.frequency.setValueAtTime(f0 || 600, t0);
    if (f1) filt.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    filt.Q.value = 0.8;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.1, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  },
  /* loops updated by proximity each frame */
  startLoops: function () {
    var ctx = this.ensure();
    if (!ctx || this.ambientOn || !this.noiseBuf) return;
    this.ambientOn = true;
    var i;
    /* wind ambience */
    var wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuf; wind.loop = true;
    var wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 210; wf.Q.value = 0.4;
    var wg = ctx.createGain(); wg.gain.value = 0.028;
    wind.connect(wf); wf.connect(wg); wg.connect(this.master);
    wind.start();
    /* soft pad chord */
    var freqs = [110, 164.81, 220];
    for (i = 0; i < freqs.length; i++) {
      var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freqs[i];
      var og = ctx.createGain(); og.gain.value = 0.006;
      var lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + i * 0.03;
      var lg = ctx.createGain(); lg.gain.value = 0.004;
      lfo.connect(lg); lg.connect(og.gain);
      o.connect(og); og.connect(this.master);
      o.start(); lfo.start();
    }
    /* furnace roar (gain driven by distance) */
    var roar = ctx.createBufferSource();
    roar.buffer = this.noiseBuf; roar.loop = true;
    var rf = ctx.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 130; rf.Q.value = 0.5;
    this.roarGain = ctx.createGain(); this.roarGain.gain.value = 0;
    roar.connect(rf); rf.connect(this.roarGain); this.roarGain.connect(this.master);
    roar.start();
    /* electrolysis hum */
    var hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 52;
    var hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 220;
    this.humGain = ctx.createGain(); this.humGain.gain.value = 0;
    hum.connect(hf); hf.connect(this.humGain); this.humGain.connect(this.master);
    hum.start();
  },
  updateProximity: function (dFurnace, dCell) {
    if (!this.ctx || !this.roarGain) return;
    var g = this.muted ? 0 : clamp(1 - dFurnace / 14, 0, 1) * 0.16;
    this.roarGain.gain.value += (g - this.roarGain.gain.value) * 0.08;
    var h = this.muted ? 0 : clamp(1 - dCell / 12, 0, 1) * 0.05;
    if (this.humGain) this.humGain.gain.value += (h - this.humGain.gain.value) * 0.08;
  },
  /* named SFX */
  click:   function () { this.tone(700, 0.05, 'sine', 0.05); },
  mineRock:function () { this.noise(0.12, 900, 180, 0.16, 'lowpass'); this.tone(120, 0.08, 'square', 0.05, 60); },
  chop:    function () { this.noise(0.09, 500, 120, 0.14, 'lowpass'); this.tone(90, 0.1, 'sine', 0.09, 55); },
  place:   function () { this.tone(420, 0.06, 'sine', 0.05); },
  burn:    function () { this.noise(0.5, 300, 90, 0.12, 'lowpass'); },
  smeltDone:function () { this.tone(392, 0.16, 'triangle', 0.09); this.tone(523, 0.2, 'triangle', 0.09, null, 0.12); this.tone(659, 0.3, 'triangle', 0.08, null, 0.24); },
  clang:   function () {
    this.noise(0.05, 3200, 800, 0.12, 'highpass');
    this.tone(880, 0.22, 'square', 0.06, 440);
    this.tone(1320, 0.3, 'triangle', 0.05, 660, 0.02);
    this.tone(220, 0.35, 'sine', 0.07, 110, 0.02);
  },
  zap:     function () { this.tone(1400, 0.22, 'square', 0.08, 160); this.noise(0.18, 4000, 700, 0.07, 'highpass'); },
  shoot:   function () { this.noise(0.14, 2400, 300, 0.1, 'bandpass'); this.tone(520, 0.06, 'square', 0.05, 200); },
  hit:     function () { this.tone(150, 0.1, 'square', 0.09, 60); this.noise(0.08, 700, 150, 0.1, 'lowpass'); },
  hurt:    function () { this.tone(110, 0.25, 'sawtooth', 0.1, 55); this.noise(0.2, 400, 80, 0.12, 'lowpass'); },
  growl:   function () { this.tone(70, 0.5, 'sawtooth', 0.1, 45); this.tone(52, 0.55, 'square', 0.07, 38, 0.08); },
  correct: function () { this.tone(523, 0.1, 'sine', 0.08); this.tone(659, 0.12, 'sine', 0.08, null, 0.09); this.tone(784, 0.16, 'sine', 0.07, null, 0.18); },
  wrong:   function () { this.tone(200, 0.18, 'sawtooth', 0.09, 90); this.tone(150, 0.22, 'sawtooth', 0.07, 70, 0.1); },
  fanfare: function () {
    var seq = [523, 659, 784, 1047];
    for (var i = 0; i < seq.length; i++) this.tone(seq[i], 0.3, 'triangle', 0.09, null, i * 0.16);
  },
  bossDeath: function () { this.tone(90, 0.9, 'sawtooth', 0.12, 30); this.noise(1.0, 500, 60, 0.14, 'lowpass'); }
};

/* ============================================================
 * 4. Extraction recipes (bilingual, SOW-frozen chemistry)
 * ============================================================ */
var RECIPES_EX = {
  kiln: {
    id: 'kiln', station: 'kiln',
    title: { en: '🔥 Charcoal Kiln', zh: '🔥 炭窯' },
    intro: { en: 'Burn wood carefully (limited air) to make carbon — charcoal. It becomes coke for the blast furnace and fuel for the generator.',
             zh: '在空氣有限下小心燒木材，製成碳——木炭。它會作為焦炭用於高爐，也作為發電機的燃料。' },
    formula: { en: 'Wood → heat (limited air) → Carbon (charcoal)',
               zh: '木材 → 受熱（空氣有限）→ 碳（木炭）' },
    slots: [{ key: 'wood', label: { en: 'Wood', zh: '木材' }, icon: '🪵' }],
    need: { wood: 1 }, output: { carbon: 1 },
    outputLabel: { en: 'Carbon', zh: '碳' },
    heatMs: 2000,
    captions: { en: ['Heating wood carefully…', 'Gases leave the wood…', 'Carbon (charcoal) is left…'],
                zh: ['小心加熱木材……', '氣體離開木材……', '剩下碳（木炭）……'] },
    predictQ: { en: 'Burning wood carefully in the kiln mainly makes…', zh: '在窯中小心燒木材主要產生……' },
    predictOpts: { en: ['Carbon (charcoal)', 'Pure iron metal', 'Only neon gas'],
                   zh: ['碳（木炭）', '純鐵金屬', '只有氖氣'] },
    predictA: 0,
    explainQ: { en: 'Why do we make carbon before extracting iron or copper?',
                zh: '為甚麼提取鐵或銅前要先製碳？' },
    explainOpts: { en: ['Carbon (as coke / CO) removes oxygen from the metal oxide so metal is left',
                         'Carbon only cools the furnace', 'Carbon turns the metal into plastic'],
                   zh: ['碳（作為焦炭／CO）把氧從金屬氧化物中除去，留下金屬',
                         '碳只是冷卻高爐', '碳把金屬變成塑膠'] },
    explainA: 0,
    missionFlag: 'madeCarbon',
    bonusQs: [
      { q: { en: 'What is the chemical symbol for carbon?', zh: '碳的化學符號是？' },
        opts: { en: ['C', 'Ca', 'Cu'], zh: ['C', 'Ca', 'Cu'] }, a: 0 },
      { q: { en: 'Charcoal is mostly…', zh: '木炭主要成分是……' },
        opts: { en: ['Carbon', 'Gold', 'Salt'], zh: ['碳', '金', '鹽'] }, a: 0 }
    ]
  },
  furnace_iron: {
    id: 'furnace_iron', station: 'furnace',
    title: { en: '🔥 Blast Furnace — Iron', zh: '🔥 高爐 — 鐵' },
    intro: { en: 'The real blast furnace charge: haematite (Fe₂O₃) + coke (carbon) + limestone. Hot air is blasted in at the bottom; carbon monoxide — made inside from coke — does the reducing.',
             zh: '真正的高爐爐料：赤鐵礦（Fe₂O₃）＋焦炭（碳）＋石灰石。熱風從底部鼓入；由焦炭在爐內製成的一氧化碳負責還原。' },
    formula: { en: 'Word: iron(III) oxide + carbon monoxide → iron + carbon dioxide\nMain: Fe₂O₃ + 3CO → 2Fe + 3CO₂\nCO made by: CO₂ + C → 2CO',
               zh: '文字：氧化鐵(III)＋一氧化碳→鐵＋二氧化碳\n主反應：Fe₂O₃ + 3CO → 2Fe + 3CO₂\nCO的來源：CO₂ + C → 2CO' },
    slots: [
      { key: 'haematite', label: { en: 'Haematite Fe₂O₃', zh: '赤鐵礦 Fe₂O₃' }, icon: '🟥' },
      { key: 'carbon', label: { en: 'Coke (carbon)', zh: '焦炭（碳）' }, icon: '⬛' },
      { key: 'limestone', label: { en: 'Limestone CaCO₃', zh: '石灰石 CaCO₃' }, icon: '🪨' }
    ],
    need: { haematite: 1, carbon: 1, limestone: 1 },
    output: { fe: 1 },
    outputLabel: { en: 'Molten iron', zh: '鐵水' },
    heatMs: 3400, zones: true, slag: true,
    captions: { en: ['Hot air blasts in — coke burns: C + O₂ → CO₂',
                     'CO₂ over hot coke → CO: CO₂ + C → 2CO',
                     'CO reduces haematite: Fe₂O₃ + 3CO → 2Fe + 3CO₂',
                     'Limestone removes sand as slag — molten iron is tapped!'],
                zh: ['熱風鼓入——焦炭燃燒：C + O₂ → CO₂',
                     'CO₂經過熾熱焦炭→CO：CO₂ + C → 2CO',
                     'CO還原赤鐵礦：Fe₂O₃ + 3CO → 2Fe + 3CO₂',
                     '石灰石除去泥沙成爐渣——放出鐵水！'] },
    predictQ: { en: 'Which substance ACTUALLY removes oxygen from haematite?',
                zh: '實際上哪種物質把氧從赤鐵礦中除去？' },
    predictOpts: { en: ['Carbon monoxide', 'Carbon (coke)', 'Limestone', 'Oxygen in hot air'],
                   zh: ['一氧化碳', '碳（焦炭）', '石灰石', '熱風中的氧氣'] },
    predictA: 0,
    explainQ: { en: 'Which balanced equation is the key blast-furnace reaction?',
                zh: '哪個平衡方程式是高爐的關鍵反應？' },
    explainOpts: { en: ['Fe₂O₃ + 3CO → 2Fe + 3CO₂', '2FeO + C → 2Fe + CO₂', 'Fe₂O₃ + O₂ → 2Fe + CO₂'],
                   zh: ['Fe₂O₃ + 3CO → 2Fe + 3CO₂', '2FeO + C → 2Fe + CO₂', 'Fe₂O₃ + O₂ → 2Fe + CO₂'] },
    explainA: 0,
    missionFlag: 'extractedIron',
    bonusQs: [
      { q: { en: 'CO is made inside the furnace by…', zh: 'CO在爐內由哪反應製造？' },
        opts: { en: ['CO₂ + C → 2CO', 'CaCO₃ → CaO + CO₂', '2Ag₂O → 4Ag + O₂'],
                zh: ['CO₂ + C → 2CO', 'CaCO₃ → CaO + CO₂', '2Ag₂O → 4Ag + O₂'] }, a: 0 },
      { q: { en: 'What does limestone do in the furnace?', zh: '石灰石在高爐中做甚麼？' },
        opts: { en: ['Removes sandy impurities as slag', 'Reduces the ore to iron', 'Makes carbon monoxide'],
                zh: ['除去泥沙雜質成爐渣', '把礦石還原成鐵', '製造一氧化碳'] }, a: 0 },
      { q: { en: 'Fe₂O₃ + ?CO → 2Fe + 3CO₂ — the coefficient of CO is…',
             zh: 'Fe₂O₃ + ?CO → 2Fe + 3CO₂——CO的係數是……' },
        opts: { en: ['3', '1', '2'], zh: ['3', '1', '2'] }, a: 0 }
    ]
  },
  copper: {
    id: 'copper', station: 'copper',
    title: { en: '🟩 Copper Works — Copper extraction', zh: '🟩 煉銅工場 — 提取銅' },
    intro: { en: 'Copper is BELOW carbon in the reactivity series, so carbon can remove the oxygen: copper(II) oxide + carbon → copper + carbon dioxide.',
             zh: '銅在活動性順序中位於碳以下，所以碳能除去氧：氧化銅(II)＋碳→銅＋二氧化碳。' },
    formula: { en: 'Word: copper(II) oxide + carbon → copper + carbon dioxide\n2CuO + C → 2Cu + CO₂',
               zh: '文字：氧化銅(II)＋碳→銅＋二氧化碳\n2CuO + C → 2Cu + CO₂' },
    slots: [
      { key: 'cuOre', label: { en: 'Copper ore CuO', zh: '銅礦 CuO' }, icon: '🟩' },
      { key: 'carbon', label: { en: 'Carbon', zh: '碳' }, icon: '⬛' }
    ],
    need: { cuOre: 1, carbon: 1 },
    output: { cu: 1 },
    outputLabel: { en: 'Copper metal', zh: '銅金屬' },
    heatMs: 2600,
    captions: { en: ['Heating copper oxide with carbon…', 'Oxygen is removed from CuO…', 'Copper metal forms…'],
                zh: ['把氧化銅與碳加熱……', '氧從CuO中被除去……', '銅金屬生成……'] },
    predictQ: { en: 'Word equation for copper extraction is…', zh: '提取銅的文字方程式是……' },
    predictOpts: { en: ['copper(II) oxide + carbon → copper + carbon dioxide',
                        'copper + oxygen → copper oxide only', 'gold → copper + carbon'],
                   zh: ['氧化銅(II)＋碳→銅＋二氧化碳', '只有銅＋氧→氧化銅', '金→銅＋碳'] },
    predictA: 0,
    explainQ: { en: 'Which balanced equation matches that word equation?', zh: '哪個平衡方程式與文字方程式相符？' },
    explainOpts: { en: ['2CuO + C → 2Cu + CO₂', '2CuO + C → 2CuO + CO₂', 'CuO + O₂ → Cu + CO₂'],
                   zh: ['2CuO + C → 2Cu + CO₂', '2CuO + C → 2CuO + CO₂', 'CuO + O₂ → Cu + CO₂'] },
    explainA: 0,
    missionFlag: 'extractedCopper',
    bonusQs: [
      { q: { en: 'Balance: ? CuO + C → ? Cu + CO₂', zh: '配平：? CuO + C → ? Cu + CO₂' },
        opts: { en: ['2 CuO + C → 2 Cu + CO₂', '1 CuO + C → 3 Cu + CO₂', '4 CuO + C → 1 Cu + CO₂'],
                zh: ['2 CuO + C → 2 Cu + CO₂', '1 CuO + C → 3 Cu + CO₂', '4 CuO + C → 1 Cu + CO₂'] }, a: 0 },
      { q: { en: 'Mining copper ore is not the same as extraction because…',
             zh: '開採銅礦不等於提取，因為……' },
        opts: { en: ['Extraction turns the compound into metal', 'Mining already makes pure metal always', 'Mining only happens on the moon'],
                zh: ['提取是把化合物變成金屬', '採礦總是已造出純金屬', '採礦只在月球發生'] }, a: 0 }
    ]
  },
  silver_roast: {
    id: 'silver_roast', station: 'copper',
    title: { en: '🩶 Silver oxide — heat to get silver', zh: '🩶 氧化銀 — 加熱得銀' },
    intro: { en: 'Silver is mined here as silver oxide (Ag₂O), NOT free metal. Silver is so unreactive that heat ALONE decomposes its oxide: silver oxide → silver + oxygen.',
             zh: '這裏的銀以氧化銀（Ag₂O）開採，不是游離金屬。銀非常不活潑，單靠加熱便能分解其氧化物：氧化銀→銀＋氧氣。' },
    formula: { en: 'Word: silver oxide → silver + oxygen\n2Ag₂O → 4Ag + O₂',
               zh: '文字：氧化銀→銀＋氧氣\n2Ag₂O → 4Ag + O₂' },
    slots: [{ key: 'agOre', label: { en: 'Ag₂O ore', zh: 'Ag₂O 礦' }, icon: '🩶' }],
    need: { agOre: 1 },
    output: { silver: 1 },
    outputLabel: { en: 'Silver metal', zh: '銀金屬' },
    heatMs: 2400,
    captions: { en: ['Heating silver oxide…', 'Silver oxide breaks down…', 'Silver metal + oxygen gas…'],
                zh: ['加熱氧化銀……', '氧化銀分解……', '銀金屬＋氧氣……'] },
    predictQ: { en: 'Word equation for heating silver oxide is…', zh: '加熱氧化銀的文字方程式是……' },
    predictOpts: { en: ['silver oxide → silver + oxygen', 'silver + carbon → silver oxide', 'gold → silver + oxygen'],
                   zh: ['氧化銀→銀＋氧氣', '銀＋碳→氧化銀', '金→銀＋氧氣'] },
    predictA: 0,
    explainQ: { en: 'Which balanced equation is correct?', zh: '哪個平衡方程式正確？' },
    explainOpts: { en: ['2Ag₂O → 4Ag + O₂', 'Ag₂O → Ag + O₂', '2Ag₂O → 2Ag + O₂'],
                   zh: ['2Ag₂O → 4Ag + O₂', 'Ag₂O → Ag + O₂', '2Ag₂O → 2Ag + O₂'] },
    explainA: 0,
    missionFlag: 'extractedSilver',
    bonusQs: [
      { q: { en: 'Why can gold be used directly, but silver oxide cannot?',
             zh: '為甚麼金可直接使用，氧化銀卻不能？' },
        opts: { en: ['Gold is found as free metal; silver here is a compound (oxide)', 'Silver is already pure gold', 'Gold always needs carbon'],
                zh: ['金以游離金屬存在；這裏的銀是化合物（氧化物）', '銀已是純金', '金總是需要碳'] }, a: 0 },
      { q: { en: 'Balance: 2Ag₂O → ? Ag + O₂', zh: '配平：2Ag₂O → ? Ag + O₂' },
        opts: { en: ['4 Ag', '2 Ag', '1 Ag'], zh: ['4 Ag', '2 Ag', '1 Ag'] }, a: 0 }
    ]
  },
  generator_power: {
    id: 'generator_power', station: 'generator',
    title: { en: '⚡ Power Generator — Carbon → Electricity', zh: '⚡ 發電機 — 碳→電力' },
    intro: { en: 'Burn carbon as a fuel: chemical energy → heat → electricity. The electrolysis cell needs ⚡ to extract aluminium.',
             zh: '把碳作為燃料燃燒：化學能→熱→電力。電解池需要⚡才能提取鋁。' },
    formula: { en: 'C (fuel) + O₂ → CO₂ + heat → ⚡ electricity ×2',
               zh: 'C（燃料）＋O₂→CO₂＋熱→⚡電力×2' },
    slots: [{ key: 'carbon', label: { en: 'Carbon', zh: '碳' }, icon: '⬛' }],
    need: { carbon: 1 },
    output: { electricity: 2 },
    outputLabel: { en: '⚡ Electricity ×2', zh: '⚡ 電力 ×2' },
    heatMs: 2200,
    captions: { en: ['Burning carbon as a fuel…', 'Heat released…', 'Electricity stored for electrolysis…'],
                zh: ['把碳作為燃料燃燒……', '釋放熱能……', '儲存電力用於電解……'] },
    predictQ: { en: 'Why make electricity before extracting aluminium?', zh: '為甚麼提取鋁前要先發電？' },
    predictOpts: { en: ['Aluminium extraction needs electrical energy (electrolysis)',
                        'Electricity turns aluminium into wood', 'Electricity only cools iron ore'],
                   zh: ['提取鋁需要電能（電解）', '電力把鋁變成木材', '電力只是冷卻鐵礦'] },
    predictA: 0,
    explainQ: { en: 'The energy changes in the generator are…', zh: '發電機中的能量變化是……' },
    explainOpts: { en: ['chemical energy → heat → electrical energy', 'electrical → chemical only', 'nothing changes'],
                   zh: ['化學能→熱→電能', '只有電能→化學能', '沒有變化'] },
    explainA: 0,
    missionFlag: 'madePower',
    bonusQs: [
      { q: { en: 'Electrolysis of aluminium oxide needs…', zh: '電解氧化鋁需要……' },
        opts: { en: ['Electrical energy', 'Only sand', 'No energy'], zh: ['電能', '只有沙', '不需要能量'] }, a: 0 }
    ]
  },
  al_cell: {
    id: 'al_cell', station: 'cell',
    title: { en: '⚡ Electrolysis Cell — Aluminium', zh: '⚡ 電解池 — 鋁' },
    intro: { en: 'Aluminium is ABOVE carbon — carbon cannot extract it. Dissolve Al₂O₃ in molten cryolite (lowers the melting point, saves energy), then pass current through. Uses 1 ⚡ from your bag.',
             zh: '鋁在碳以上——碳無法提取它。把Al₂O₃溶於熔融冰晶石（降低熔點、節省能量），再通電。消耗背包中的1⚡。' },
    formula: { en: 'Word: aluminium oxide → aluminium + oxygen\n2Al₂O₃ → 4Al + 3O₂ (electrolysis in molten cryolite)',
               zh: '文字：氧化鋁→鋁＋氧氣\n2Al₂O₃ → 4Al + 3O₂（在熔融冰晶石中電解）' },
    slots: [{ key: 'alOre', label: { en: 'Bauxite (Al ore)', zh: '鋁土礦（鋁礦石）' }, icon: '🟫' }],
    need: { alOre: 1 }, needInv: { electricity: 1 },
    output: { al: 1 },
    outputLabel: { en: 'Aluminium metal', zh: '鋁金屬' },
    heatMs: 3000,
    captions: { en: ['Al₂O₃ dissolves in molten cryolite…', 'Electric current passes through…', 'Aluminium metal forms at the cathode…'],
                zh: ['Al₂O₃溶於熔融冰晶石……', '電流通過……', '鋁金屬在陰極生成……'] },
    predictQ: { en: 'Why is Al₂O₃ dissolved in molten cryolite?', zh: '為甚麼把Al₂O₃溶於熔融冰晶石？' },
    predictOpts: { en: ['It lowers the melting point and saves energy', 'Cryolite is the aluminium ore', 'It makes aluminium more reactive'],
                   zh: ['降低熔點、節省能量', '冰晶石就是鋁礦石', '令鋁更活潑'] },
    predictA: 0,
    explainQ: { en: 'Which balanced equation is correct for electrolysis of Al₂O₃?',
                zh: '電解Al₂O₃的正確平衡方程式是哪個？' },
    explainOpts: { en: ['2Al₂O₃ → 4Al + 3O₂', '2Al₂O₃ → 2Al + O₂', 'Al₂O₃ → Al + O₂ (unbalanced)'],
                   zh: ['2Al₂O₃ → 4Al + 3O₂', '2Al₂O₃ → 2Al + O₂', 'Al₂O₃ → Al + O₂（未配平）'] },
    explainA: 0,
    missionFlag: 'extractedAluminium',
    bonusQs: [
      { q: { en: 'Balance: 2Al₂O₃ → 4Al + ? O₂', zh: '配平：2Al₂O₃ → 4Al + ? O₂' },
        opts: { en: ['3', '1', '6'], zh: ['3', '1', '6'] }, a: 0 },
      { q: { en: 'Why electricity for aluminium, not carbon like iron?', zh: '為甚麼鋁用電力，而不像鐵那樣用碳？' },
        opts: { en: ['Al is above carbon — too reactive for carbon to extract', 'Al is already pure gold', 'Carbon cannot burn'],
                zh: ['鋁在碳以上——太活潑，碳無法提取', '鋁已是純金', '碳不能燃燒'] }, a: 0 }
    ]
  }
};

/* ============================================================
 * 5. Game state, blocks, world generation
 * ============================================================ */
var BLOCK = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, HAEMATITE: 4, COPPER_ORE: 5,
  WOOD: 6, BEDROCK: 7, PATH: 8, AG_ORE: 9, GOLD: 10, BAUXITE: 11,
  LIMESTONE: 12, LEAF: 13
};
var DIGGABLE = {};
DIGGABLE[BLOCK.GRASS] = 1; DIGGABLE[BLOCK.DIRT] = 1; DIGGABLE[BLOCK.STONE] = 1;
DIGGABLE[BLOCK.HAEMATITE] = 1; DIGGABLE[BLOCK.COPPER_ORE] = 1; DIGGABLE[BLOCK.WOOD] = 1;
DIGGABLE[BLOCK.PATH] = 1; DIGGABLE[BLOCK.AG_ORE] = 1; DIGGABLE[BLOCK.GOLD] = 1;
DIGGABLE[BLOCK.BAUXITE] = 1; DIGGABLE[BLOCK.LIMESTONE] = 1;

var WX = 40, WY = 10, WZ = 40;
var PLAYER_R = 0.32, PLAYER_H = 1.7;
var CAM_DIST = 5.2, CAM_HEIGHT = 2.15, CAM_SMOOTH = 12;
var MOUSE_SENS = 0.0021;
var WALK_SPEED = 5.2, SPRINT_SPEED = 8.0, JUMP_V = 0.30, GRAVITY = 0.85;
var MINE_COOLDOWN = 140, MINE_RANGE = 6.5;
var BASE_FOV = 60, AIM_FOV = 32, currentFov = BASE_FOV;

var STATIONS = {
  kiln:      { x: 11, z: 13, color: 0x78716c, r: 3.4, labelKey: 'st_kiln',      name: { en: 'Charcoal Kiln', zh: '炭窯' } },
  furnace:   { x: 13, z: 22, color: 0xff6b35, r: 3.9, labelKey: 'st_furnace',   name: { en: 'Blast Furnace', zh: '高爐' } },
  copper:    { x: 29, z: 22, color: 0x22c55e, r: 3.4, labelKey: 'st_copper',    name: { en: 'Copper Works', zh: '煉銅工場' } },
  generator: { x: 28, z: 16, color: 0xf59e0b, r: 3.2, labelKey: 'st_generator', name: { en: 'Power Generator', zh: '發電機' } },
  cell:      { x: 33, z: 27, color: 0x22d3ee, r: 3.4, labelKey: 'st_cell',      name: { en: 'Electrolysis Cell', zh: '電解池' } },
  craft:     { x: 26, z: 13, color: 0xfbbf24, r: 3.4, labelKey: 'st_craft',     name: { en: 'Crafting Anvil', zh: '鍛造鐵砧' } },
  monument:  { x: 20, z: 11, color: 0xa8a29e, r: 3.0, labelKey: 'st_monument',  name: { en: 'Discovery Monument', zh: '發現石碑' } },
  boss:      { x: 20, z: 34, color: 0xa855f7, r: 3.5, labelKey: 'st_boss',      name: { en: 'Boss Gate', zh: 'Boss之門' } }
};

var world = new Uint8Array(WX * WY * WZ);
var scene, camera, renderer, meshGroup, sharedGeo, playerRig;
var blockMeshes = [], blockMats = {};
var player = { x: 20.5, y: 4, z: 20.5, vy: 0, onGround: false, facing: 0 };
var yaw = 0, pitch = 0.28;
var keys = Object.create(null);
var pointerLocked = false, touchMode = false;
/* Fallback for embedded hubs/iframes where pointer lock is blocked: drag to look, click to mine */
var dragLookMode = false;
var dragLookActive = false, dragMoved = false, dragLastX = 0, dragLastY = 0;
var touchStick = { x: 0, y: 0, active: false, id: null };
var touchLookId = null, touchLookLast = null;
var touchSprint = false, touchJump = false;
var TOUCH_LOOK_SENS = 0.0042;
var phase = 'menu', uiOpen = false;
var relaxedMode = false;
var inv = {
  wood: 0, carbon: 0, haematite: 0, limestone: 0, cuOre: 0, alOre: 0, agOre: 0,
  gold: 0, fe: 0, cu: 0, al: 0, silver: 0, electricity: 0
};
var weapons = [null, null, null, null, null, null];
var hotbarIdx = -1, hasArmour = false, equippedWeaponId = null;
var runTimerActive = false, runStartMs = 0, runPenaltySec = 0, runTimerInterval = null;
var mission = {
  gotWood: false, madeCarbon: false, minedHaematite: false, minedLimestone: false,
  extractedIron: false, extractedCopper: false, madePower: false, extractedAluminium: false,
  extractedSilver: false, craftedWeapon: false, craftedArmour: false, timelineSolved: false,
  defeatedBoss: false, failedHeats: 0, bossCorrect: 0, bossWrong: 0
};
var processMastery = {}, processSuccessCount = {}, pendingBonus = null;
var extractActive = null, reactorSlots = [];
var heating = false, heatT = 0, heatMs = 2000, heatMode = 'success';
var predictChoice = -1, pendingExplain = false;
var boss = { hp: 48, maxHp: 48, x: 20.5, z: 32.5, mesh: null, lastAttack: 0, hits: 0, anim: 0, dying: 0 };
var playerHp = 100, lastMelee = 0, lastMine = 0, mineHeld = false;
var aimZoom = false, rmbDown = false, aimToggleLock = false, lastBowShot = 0;
var arrows = [], dmgFloats = [], particles = [], smokes = [];
var toastTimer = 0, toastQueue = [];
var dodgeOpen = false, dodgeTimer = 0, dodgeMax = 10, dodgeAnswered = false, dodgeInterval = null;
var quizBag = [];
var walkPhase = 0, lastFrameTs = 0, dt = 1 / 60;
var highlightMesh = null, camSmoothPos = null, shakeT = 0;
var swingState = { active: false, t: 0, hitDone: false, dmg: 0, w: null };
var swingDur = 0.38, slashMesh = null;
var stationModels = {}, furnacePourT = 0, cellArcSprites = [], generatorWheel = null;
var beaconMesh = null, beaconStationKey = null;
var labelSprites = [];
var minimapBase = null, minimapCtx = null;
var treePositions = [], pondCenter = { x: 33, z: 6 };
var discoveredCards = { gold: false, copper: false, silver: false, iron: false, aluminium: false };
var tlPlacement = [null, null, null, null, null];
var wrongLog = [];
var BEST_KEY = 'meq2_best_time_v2';

function idx(x, y, z) { return x + y * WX + z * WX * WY; }
function inBounds(x, y, z) { return x >= 0 && x < WX && y >= 0 && y < WY && z >= 0 && z < WZ; }
function getB(x, y, z) {
  x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
  if (!inBounds(x, y, z)) return BLOCK.BEDROCK;
  return world[idx(x, y, z)];
}
function setB(x, y, z, t) {
  x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
  if (inBounds(x, y, z)) world[idx(x, y, z)] = t;
}
function isSolid(t) { return t !== BLOCK.AIR && t !== BLOCK.LEAF; }

function clearAbove(x, z, fromY) {
  for (var y = fromY; y < WY; y++) setB(x, y, z, BLOCK.AIR);
}
function fillSurface(x0, z0, x1, z1, topBlock) {
  var x, z;
  for (x = x0; x <= x1; x++) {
    for (z = z0; z <= z1; z++) {
      if (!inBounds(x, 0, z)) continue;
      clearAbove(x, z, 4);
      setB(x, 1, z, BLOCK.DIRT);
      setB(x, 2, z, BLOCK.DIRT);
      setB(x, 3, z, topBlock);
    }
  }
}
function makeHill(cx, cz, radius, oreType) {
  var x, z, y, dx, dz, dist, h;
  var rng = makeRng(cx * 731 + cz * 37 + radius * 11);
  for (x = cx - radius; x <= cx + radius; x++) {
    for (z = cz - radius; z <= cz + radius; z++) {
      if (!inBounds(x, 0, z)) continue;
      dx = x - cx; dz = z - cz;
      dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > radius) continue;
      h = Math.floor((1 - dist / radius) * 3);
      for (y = 4; y <= 3 + h; y++) {
        if (y >= WY) break;
        if (y >= 4 && rng() < 0.45 && oreType) setB(x, y, z, oreType);
        else setB(x, y, z, BLOCK.STONE);
      }
      if (h >= 1 && rng() < 0.35 && oreType) setB(x, 4, z, oreType);
    }
  }
}
function pathLine(x0, z0, x1, z1) {
  var steps = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0), 1);
  var i, tt, x, z, dx, dz;
  for (i = 0; i <= steps; i++) {
    tt = i / steps;
    x = Math.round(x0 + (x1 - x0) * tt);
    z = Math.round(z0 + (z1 - z0) * tt);
    for (dx = -1; dx <= 1; dx++) {
      for (dz = -1; dz <= 1; dz++) {
        if (!inBounds(x + dx, 0, z + dz)) continue;
        clearAbove(x + dx, z + dz, 4);
        setB(x + dx, 3, z + dz, BLOCK.PATH);
      }
    }
  }
}
function placeHiddenNative(x, z, blockType) {
  if (!inBounds(x, 0, z)) return;
  clearAbove(x, z, 3);
  setB(x, 1, z, BLOCK.DIRT);
  setB(x, 2, z, BLOCK.DIRT);
  setB(x, 3, z, blockType);
}
function placeScatteredBauxite(count) {
  var n = 0, tries = 0, x, z;
  var rng = makeRng(90210);
  while (n < count && tries < 220) {
    tries++;
    x = 30 + Math.floor(rng() * 9);
    z = 24 + Math.floor(rng() * 14);
    if (!inBounds(x, 0, z)) continue;
    if (x >= 14 && x <= 26 && z <= 26) continue;
    if (getB(x, 3, z) !== BLOCK.GRASS && getB(x, 3, z) !== BLOCK.STONE) continue;
    clearAbove(x, z, 4);
    setB(x, 3, z, BLOCK.BAUXITE);
    if (rng() < 0.35) setB(x, 4, z, BLOCK.BAUXITE);
    n++;
  }
}
function buildWorld() {
  var i, x, z, y, trees, tries, key, s, dx, dz;
  var rng = makeRng(20260805);

  for (i = 0; i < world.length; i++) world[i] = BLOCK.AIR;
  for (x = 0; x < WX; x++) {
    for (z = 0; z < WZ; z++) {
      setB(x, 0, z, BLOCK.BEDROCK);
      setB(x, 1, z, BLOCK.DIRT);
      setB(x, 2, z, BLOCK.DIRT);
      setB(x, 3, z, BLOCK.GRASS);
    }
  }

  /* West: haematite hills */
  makeHill(7, 20, 5, BLOCK.HAEMATITE);
  makeHill(9, 12, 4, BLOCK.HAEMATITE);
  makeHill(6, 28, 4, BLOCK.HAEMATITE);
  for (i = 0; i < 26; i++) {
    x = 3 + Math.floor(rng() * 10);
    z = 10 + Math.floor(rng() * 20);
    clearAbove(x, z, 4);
    setB(x, 3, z, BLOCK.HAEMATITE);
  }

  /* East: copper quarry */
  makeHill(33, 20, 5, BLOCK.COPPER_ORE);
  makeHill(31, 12, 4, BLOCK.COPPER_ORE);
  makeHill(34, 18, 4, BLOCK.COPPER_ORE);
  for (i = 0; i < 26; i++) {
    x = 27 + Math.floor(rng() * 10);
    z = 10 + Math.floor(rng() * 18);
    clearAbove(x, z, 4);
    setB(x, 3, z, BLOCK.COPPER_ORE);
  }

  /* North-west: limestone quarry */
  makeHill(6, 33, 4, BLOCK.LIMESTONE);
  makeHill(11, 36, 3, BLOCK.LIMESTONE);
  for (i = 0; i < 16; i++) {
    x = 2 + Math.floor(rng() * 11);
    z = 30 + Math.floor(rng() * 8);
    clearAbove(x, z, 4);
    setB(x, 3, z, BLOCK.LIMESTONE);
  }

  /* South forest with canopies */
  trees = 0; tries = 0;
  while (trees < 26 && tries < 160) {
    tries++;
    x = 8 + Math.floor(rng() * 24);
    z = 2 + Math.floor(rng() * 9);
    if (getB(x, 3, z) !== BLOCK.GRASS && getB(x, 3, z) !== BLOCK.PATH) continue;
    clearAbove(x, z, 4);
    for (y = 4; y <= 7; y++) setB(x, y, z, BLOCK.WOOD);
    /* leaf canopy */
    var cx2, cz2, cy2;
    for (cx2 = -1; cx2 <= 1; cx2++) {
      for (cz2 = -1; cz2 <= 1; cz2++) {
        for (cy2 = 0; cy2 <= 1; cy2++) {
          if (inBounds(x + cx2, 7 + cy2, z + cz2) && getB(x + cx2, 7 + cy2, z + cz2) === BLOCK.AIR) {
            setB(x + cx2, 7 + cy2, z + cz2, BLOCK.LEAF);
          }
        }
      }
    }
    if (inBounds(x, 9, z)) setB(x, 9, z, BLOCK.LEAF);
    treePositions.push({ x: x, z: z });
    trees++;
  }

  /* Village plaza + paths */
  fillSurface(16, 14, 24, 22, BLOCK.PATH);
  pathLine(20, 18, 8, 20);
  pathLine(20, 18, 32, 20);
  pathLine(20, 18, 20, 8);
  pathLine(20, 18, 20, 33);
  pathLine(20, 18, 11, 13);
  pathLine(20, 18, 13, 22);
  pathLine(20, 18, 29, 22);
  pathLine(20, 18, 26, 13);
  pathLine(20, 18, 8, 32);   /* limestone */
  pathLine(20, 18, 20, 12);  /* monument */
  pathLine(20, 18, 28, 16);  /* generator */
  pathLine(29, 22, 33, 27);  /* cell */

  /* Station pads */
  for (key in STATIONS) {
    if (!STATIONS.hasOwnProperty(key)) continue;
    s = STATIONS[key];
    for (dx = -2; dx <= 2; dx++) {
      for (dz = -2; dz <= 2; dz++) {
        x = s.x + dx; z = s.z + dz;
        if (!inBounds(x, 0, z)) continue;
        clearAbove(x, z, 4);
        setB(x, 3, z, BLOCK.PATH);
      }
    }
  }

  /* Boss arena */
  fillSurface(15, 28, 25, 37, BLOCK.PATH);

  /* Pond (sunken water — floor one block below the surface) */
  var px, pz;
  for (px = -2; px <= 2; px++) {
    for (pz = -2; pz <= 2; pz++) {
      if (px * px + pz * pz > 5) continue;
      x = pondCenter.x + px; z = pondCenter.z + pz;
      if (!inBounds(x, 0, z)) continue;
      clearAbove(x, z, 3); /* leaves dirt floor at y=3 top */
    }
  }

  /* Corners: silver oxide + gold */
  placeHiddenNative(1, 1, BLOCK.AG_ORE);
  placeHiddenNative(38, 1, BLOCK.AG_ORE);
  placeHiddenNative(38, 38, BLOCK.GOLD);

  /* Bauxite scattered east */
  placeScatteredBauxite(14);
}

/* ============================================================
 * 6. Textures + materials + chunk meshing
 * ============================================================ */
function makeTex(kind) {
  var cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  var c = cv.getContext('2d');
  var rng = makeRng(kind.length * 977 + kind.charCodeAt(0) * 131);
  var i, x, y;

  function speckle(col, n, size, alpha) {
    c.globalAlpha = alpha == null ? 1 : alpha;
    c.fillStyle = col;
    for (i = 0; i < n; i++) {
      c.fillRect(Math.floor(rng() * 64), Math.floor(rng() * 64), size, size);
    }
    c.globalAlpha = 1;
  }

  if (kind === 'grassTop') {
    c.fillStyle = '#4e9a3d'; c.fillRect(0, 0, 64, 64);
    speckle('#5fb44b', 90, 2, 0.7);
    speckle('#3d7d30', 70, 2, 0.7);
    speckle('#74c261', 30, 1, 0.8);
  } else if (kind === 'grassSide') {
    c.fillStyle = '#8a5a33'; c.fillRect(0, 0, 64, 64);
    speckle('#75492a', 60, 2, 0.8);
    speckle('#9c6b40', 50, 2, 0.6);
    c.fillStyle = '#4e9a3d'; c.fillRect(0, 0, 64, 14);
    speckle('#3d7d30', 26, 2, 0.8);
    c.fillStyle = '#5fb44b';
    for (i = 0; i < 12; i++) c.fillRect(Math.floor(rng() * 60), 12, 3, 4 + Math.floor(rng() * 5));
  } else if (kind === 'dirt') {
    c.fillStyle = '#8a5a33'; c.fillRect(0, 0, 64, 64);
    speckle('#75492a', 80, 2, 0.8);
    speckle('#9c6b40', 60, 2, 0.7);
    speckle('#5f3c20', 24, 2, 0.6);
  } else if (kind === 'stone') {
    c.fillStyle = '#8d929c'; c.fillRect(0, 0, 64, 64);
    speckle('#7a7f8a', 70, 3, 0.7);
    speckle('#a2a7b1', 50, 2, 0.7);
    c.strokeStyle = '#6b7078'; c.lineWidth = 1;
    for (i = 0; i < 5; i++) {
      c.beginPath();
      c.moveTo(rng() * 64, rng() * 64);
      c.lineTo(rng() * 64, rng() * 64);
      c.stroke();
    }
  } else if (kind === 'path') {
    c.fillStyle = '#c9a86f'; c.fillRect(0, 0, 64, 64);
    speckle('#b3915a', 70, 2, 0.8);
    speckle('#dcbf8d', 40, 2, 0.7);
    c.fillStyle = '#a5824e';
    for (i = 0; i < 8; i++) {
      c.beginPath();
      c.arc(rng() * 64, rng() * 64, 2 + rng() * 3, 0, Math.PI * 2);
      c.fill();
    }
  } else if (kind === 'bedrock') {
    c.fillStyle = '#23272e'; c.fillRect(0, 0, 64, 64);
    speckle('#32363e', 60, 3, 0.8);
    speckle('#16181d', 40, 2, 0.8);
  } else if (kind === 'haematite') {
    /* red-brown ore with metallic specks + dark streaks */
    c.fillStyle = '#7f3226'; c.fillRect(0, 0, 64, 64);
    speckle('#93402f', 70, 3, 0.8);
    speckle('#5e231a', 60, 3, 0.7);
    c.strokeStyle = '#4a1c14'; c.lineWidth = 3;
    for (i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(rng() * 64, 0);
      c.lineTo(rng() * 64, 64);
      c.stroke();
    }
    speckle('#d8c9bd', 26, 2, 0.9);  /* metallic glints */
    speckle('#f0d9c0', 12, 1, 0.9);
  } else if (kind === 'copperOre') {
    c.fillStyle = '#1c6b40'; c.fillRect(0, 0, 64, 64);
    speckle('#2a8a53', 60, 3, 0.8);
    c.fillStyle = '#4ade80';
    for (i = 0; i < 16; i++) {
      c.beginPath();
      c.arc(rng() * 60 + 2, rng() * 60 + 2, 2 + rng() * 3, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = '#a7f3d0'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(4, 22); c.lineTo(60, 42); c.stroke();
    c.beginPath(); c.moveTo(10, 52); c.lineTo(52, 12); c.stroke();
  } else if (kind === 'limestone') {
    c.fillStyle = '#d8d3c4'; c.fillRect(0, 0, 64, 64);
    speckle('#c4beac', 70, 3, 0.7);
    speckle('#e9e5d8', 50, 2, 0.8);
    c.fillStyle = '#b0a892';
    for (i = 0; i < 7; i++) { /* fossil specks */
      c.beginPath();
      c.arc(rng() * 60 + 2, rng() * 60 + 2, 1.5 + rng() * 2, 0, Math.PI * 2);
      c.stroke();
    }
  } else if (kind === 'bauxite') {
    c.fillStyle = '#a2653f'; c.fillRect(0, 0, 64, 64);
    speckle('#8a5232', 70, 3, 0.8);
    speckle('#c07d4e', 50, 2, 0.7);
    speckle('#e8d5c0', 22, 2, 0.75);
    c.strokeStyle = '#75432a'; c.lineWidth = 2;
    for (i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(0, rng() * 64);
      c.lineTo(64, rng() * 64);
      c.stroke();
    }
  } else if (kind === 'wood') {
    c.fillStyle = '#6d4c33'; c.fillRect(0, 0, 64, 64);
    c.strokeStyle = '#4e3521'; c.lineWidth = 3;
    for (i = 6; i < 64; i += 10) {
      c.beginPath();
      c.moveTo(0, i);
      c.bezierCurveTo(20, i - 4, 44, i + 4, 64, i);
      c.stroke();
    }
    speckle('#846144', 24, 2, 0.7);
  } else if (kind === 'leaf') {
    c.fillStyle = '#2f7a35'; c.fillRect(0, 0, 64, 64);
    speckle('#3f9c46', 90, 3, 0.75);
    speckle('#226127', 70, 3, 0.7);
    speckle('#57b95e', 30, 2, 0.8);
  } else if (kind === 'silverOre') {
    c.fillStyle = '#565b64'; c.fillRect(0, 0, 64, 64);
    speckle('#6c727c', 60, 3, 0.8);
    c.fillStyle = '#8f2f45';
    for (i = 0; i < 12; i++) {
      c.beginPath();
      c.arc(rng() * 56 + 4, rng() * 56 + 4, 2 + rng() * 2, 0, Math.PI * 2);
      c.fill();
    }
    speckle('#d9dde2', 18, 1, 0.9);
  } else if (kind === 'goldOre') {
    c.fillStyle = '#b08a1e'; c.fillRect(0, 0, 64, 64);
    speckle('#8f6f14', 50, 3, 0.7);
    c.fillStyle = '#fde047';
    for (i = 0; i < 12; i++) {
      x = Math.floor(rng() * 56) + 4; y = Math.floor(rng() * 56) + 4;
      c.beginPath();
      c.moveTo(x, y - 4); c.lineTo(x + 1.5, y - 1); c.lineTo(x + 4, y);
      c.lineTo(x + 1.5, y + 1); c.lineTo(x, y + 4); c.lineTo(x - 1.5, y + 1);
      c.lineTo(x - 4, y); c.lineTo(x - 1.5, y - 1);
      c.closePath(); c.fill();
    }
    speckle('#fff7cc', 16, 1, 0.95);
  }

  var tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function getBlockMaterial(type) {
  type = Number(type);
  if (blockMats[type]) return blockMats[type];
  var mat, mats;
  switch (type) {
    case BLOCK.GRASS:
      /* per-face: +x -x +y -y +z -z */
      mats = [
        new THREE.MeshLambertMaterial({ map: makeTex('grassSide') }),
        new THREE.MeshLambertMaterial({ map: makeTex('grassSide') }),
        new THREE.MeshLambertMaterial({ map: makeTex('grassTop') }),
        new THREE.MeshLambertMaterial({ map: makeTex('dirt') }),
        new THREE.MeshLambertMaterial({ map: makeTex('grassSide') }),
        new THREE.MeshLambertMaterial({ map: makeTex('grassSide') })
      ];
      blockMats[type] = mats;
      return mats;
    case BLOCK.DIRT: mat = new THREE.MeshLambertMaterial({ map: makeTex('dirt') }); break;
    case BLOCK.STONE: mat = new THREE.MeshLambertMaterial({ map: makeTex('stone') }); break;
    case BLOCK.PATH: mat = new THREE.MeshLambertMaterial({ map: makeTex('path') }); break;
    case BLOCK.BEDROCK: mat = new THREE.MeshLambertMaterial({ map: makeTex('bedrock') }); break;
    case BLOCK.HAEMATITE: mat = new THREE.MeshLambertMaterial({ map: makeTex('haematite') }); break;
    case BLOCK.COPPER_ORE: mat = new THREE.MeshLambertMaterial({ map: makeTex('copperOre') }); break;
    case BLOCK.LIMESTONE: mat = new THREE.MeshLambertMaterial({ map: makeTex('limestone') }); break;
    case BLOCK.BAUXITE: mat = new THREE.MeshLambertMaterial({ map: makeTex('bauxite') }); break;
    case BLOCK.WOOD: mat = new THREE.MeshLambertMaterial({ map: makeTex('wood') }); break;
    case BLOCK.LEAF: mat = new THREE.MeshLambertMaterial({ map: makeTex('leaf') }); break;
    case BLOCK.AG_ORE:
      mat = new THREE.MeshLambertMaterial({ map: makeTex('silverOre'), emissive: 0x3f3f46, emissiveIntensity: 0.12 });
      break;
    case BLOCK.GOLD:
      mat = new THREE.MeshLambertMaterial({ map: makeTex('goldOre'), emissive: 0xca8a04, emissiveIntensity: 0.3 });
      break;
    default: mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  }
  blockMats[type] = mat;
  return mat;
}

function rebuildMesh() {
  var i, m;
  for (i = 0; i < blockMeshes.length; i++) {
    m = blockMeshes[i];
    meshGroup.remove(m);
  }
  blockMeshes = [];

  var byType = {}, x, y, zz, tt;
  for (x = 0; x < WX; x++) {
    for (y = 0; y < WY; y++) {
      for (zz = 0; zz < WZ; zz++) {
        tt = getB(x, y, zz);
        if (tt === BLOCK.AIR) continue;
        if (
          isSolid(getB(x + 1, y, zz)) && isSolid(getB(x - 1, y, zz)) &&
          isSolid(getB(x, y + 1, zz)) && isSolid(getB(x, y - 1, zz)) &&
          isSolid(getB(x, y, zz + 1)) && isSolid(getB(x, y, zz - 1))
        ) continue;
        if (!byType[tt]) byType[tt] = [];
        byType[tt].push(x + 0.5, y + 0.5, zz + 0.5);
      }
    }
  }

  var dummy = new THREE.Object3D();
  var type, list, count, mesh;
  for (type in byType) {
    if (!byType.hasOwnProperty(type)) continue;
    list = byType[type];
    count = list.length / 3;
    if (count < 1) continue;
    mesh = new THREE.InstancedMesh(sharedGeo, getBlockMaterial(type), count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (i = 0; i < count; i++) {
      dummy.position.set(list[i * 3], list[i * 3 + 1], list[i * 3 + 2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshGroup.add(mesh);
    blockMeshes.push(mesh);
  }
}

/* ============================================================
 * 7. Renderer, lighting, sky, environment dressing
 * ============================================================ */
function initThree() {
  var canvas = $('canvas');
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  /* cap pixel ratio: embedded hub browsers (esp. Firefox WebViews) can hang at retina ratios */
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x8ec8e8, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputEncoding = THREE.sRGBEncoding;

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd7ecf7, 45, 115);

  camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.1, 260);
  meshGroup = new THREE.Group();
  scene.add(meshGroup);

  /* Lights */
  scene.add(new THREE.HemisphereLight(0xcfe7ff, 0x87976b, 0.62));
  scene.add(new THREE.AmbientLight(0xffffff, 0.16));
  var sun = new THREE.DirectionalLight(0xfff1d6, 1.28);
  sun.position.set(38, 54, 16);
  sun.castShadow = true;
  var sc = sun.shadow.camera;
  sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38;
  sc.near = 10; sc.far = 140;
  sun.shadow.mapSize.width = touchMode ? 1024 : 2048;
  sun.shadow.mapSize.height = touchMode ? 1024 : 2048;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  sun.target.position.set(20, 0, 20);
  scene.add(sun);
  scene.add(sun.target);

  addSky();

  sharedGeo = new THREE.BoxGeometry(1, 1, 1);
  buildWorld();
  rebuildMesh();

  /* Ground apron beyond the world */
  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshLambertMaterial({ color: 0x4c7a3a })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(WX / 2, -0.02, WZ / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  addEnvironment();
  addStations();

  playerRig = createPlayerCharacter();
  scene.add(playerRig);

  updateCamera();
  updatePlayerVisual(false);
  renderer.render(scene, camera);

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  });
}

var clouds = [];
function addSky() {
  /* gradient dome */
  var cv = document.createElement('canvas');
  cv.width = 16; cv.height = 256;
  var c = cv.getContext('2d');
  var g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#3f86c9');
  g.addColorStop(0.45, '#8ec8e8');
  g.addColorStop(0.75, '#d9edf6');
  g.addColorStop(1, '#eef6ea');
  c.fillStyle = g; c.fillRect(0, 0, 16, 256);
  var skyTex = new THREE.CanvasTexture(cv);
  skyTex.encoding = THREE.sRGBEncoding;
  var sky = new THREE.Mesh(
    new THREE.SphereGeometry(170, 18, 12),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
  );
  sky.position.set(20, 0, 20);
  scene.add(sky);

  /* sun disc */
  var scv = document.createElement('canvas');
  scv.width = 128; scv.height = 128;
  var s = scv.getContext('2d');
  var sg = s.createRadialGradient(64, 64, 6, 64, 64, 64);
  sg.addColorStop(0, 'rgba(255,252,235,1)');
  sg.addColorStop(0.25, 'rgba(255,240,190,0.9)');
  sg.addColorStop(0.6, 'rgba(255,220,140,0.25)');
  sg.addColorStop(1, 'rgba(255,220,140,0)');
  s.fillStyle = sg; s.fillRect(0, 0, 128, 128);
  var sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(scv), transparent: true, fog: false, depthWrite: false
  }));
  sunSpr.scale.set(30, 30, 1);
  sunSpr.position.set(120, 88, 55);
  scene.add(sunSpr);

  /* clouds */
  var ccv = document.createElement('canvas');
  ccv.width = 128; ccv.height = 64;
  var cc = ccv.getContext('2d');
  var crng = makeRng(777);
  cc.fillStyle = 'rgba(255,255,255,0.92)';
  var i;
  for (i = 0; i < 14; i++) {
    cc.beginPath();
    cc.ellipse(18 + crng() * 92, 22 + crng() * 22, 12 + crng() * 16, 7 + crng() * 8, 0, 0, Math.PI * 2);
    cc.fill();
  }
  var cloudTex = new THREE.CanvasTexture(ccv);
  for (i = 0; i < 9; i++) {
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTex, transparent: true, opacity: 0.75, fog: false, depthWrite: false
    }));
    var scl = 11 + crng() * 10;
    spr.scale.set(scl, scl * 0.45, 1);
    spr.position.set(-60 + crng() * 160, 27 + crng() * 9, -30 + crng() * 100);
    spr.userData = { vx: 0.25 + crng() * 0.5 };
    scene.add(spr);
    clouds.push(spr);
  }
}

function addEnvironment() {
  var i, rng = makeRng(424242);

  /* rocks */
  var rockGeo = new THREE.DodecahedronGeometry(0.32, 0);
  var rockMat = new THREE.MeshLambertMaterial({ color: 0x8b8f99 });
  var rocks = new THREE.InstancedMesh(rockGeo, rockMat, 46);
  var dummy = new THREE.Object3D(), placed = 0, tries = 0;
  while (placed < 46 && tries < 400) {
    tries++;
    var rx = 1 + rng() * 38, rz = 1 + rng() * 38;
    if (getB(Math.floor(rx), 3, Math.floor(rz)) !== BLOCK.GRASS) continue;
    dummy.position.set(rx, 4.14, rz);
    dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    dummy.scale.setScalar(0.5 + rng() * 1.4);
    dummy.updateMatrix();
    rocks.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  rocks.count = placed;
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  scene.add(rocks);

  /* flowers (instanced coloured buds) */
  var fGeo = new THREE.ConeGeometry(0.07, 0.24, 5);
  var fMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  var flowers = new THREE.InstancedMesh(fGeo, fMat, 90);
  var cols = [0xff5d8f, 0xffd166, 0x90e0ef, 0xffa5d0, 0xffffff, 0xff8c42];
  var fc = new THREE.Color();
  placed = 0; tries = 0;
  while (placed < 90 && tries < 600) {
    tries++;
    var fx = 1 + rng() * 38, fz = 1 + rng() * 38;
    if (getB(Math.floor(fx), 3, Math.floor(fz)) !== BLOCK.GRASS) continue;
    dummy.position.set(fx, 4.12, fz);
    dummy.rotation.set(0, rng() * 6, 0);
    dummy.scale.setScalar(0.8 + rng() * 0.9);
    dummy.updateMatrix();
    flowers.setMatrixAt(placed, dummy.matrix);
    fc.setHex(cols[Math.floor(rng() * cols.length)]);
    flowers.setColorAt(placed, fc);
    placed++;
  }
  flowers.count = placed;
  if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
  scene.add(flowers);

  /* pond water */
  var pond = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 26),
    new THREE.MeshLambertMaterial({ color: 0x3b82c4, transparent: true, opacity: 0.82, emissive: 0x0e3a5c, emissiveIntensity: 0.25 })
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(pondCenter.x + 0.5, 3.72, pondCenter.z + 0.5);
  pond.receiveShadow = true;
  scene.add(pond);

  /* village houses */
  addHouse(14, 16, 0.3);
  addHouse(26, 20, -1.1);
  addHouse(17, 23, 2.2);

  /* grass tufts around plaza edges — cheap boxes */
  var tuftMat = new THREE.MeshLambertMaterial({ color: 0x69a84f });
  var tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.12, 0.4, 4), tuftMat, 70);
  placed = 0; tries = 0;
  while (placed < 70 && tries < 500) {
    tries++;
    var tx = 1 + rng() * 38, tz = 1 + rng() * 38;
    if (getB(Math.floor(tx), 3, Math.floor(tz)) !== BLOCK.GRASS) continue;
    dummy.position.set(tx, 4.18, tz);
    dummy.rotation.set(0, rng() * 6, 0);
    dummy.scale.set(0.7 + rng(), 0.7 + rng() * 1.2, 0.7 + rng());
    dummy.updateMatrix();
    tufts.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  tufts.count = placed;
  scene.add(tufts);
}

function addHouse(bx, bz, rotY) {
  var g = new THREE.Group();
  var wallMat = new THREE.MeshLambertMaterial({ color: 0xd6bd94 });
  var roofMat = new THREE.MeshLambertMaterial({ color: 0x8a3324 });
  var wall = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.9, 2.3), wallMat);
  wall.position.y = 0.95;
  wall.castShadow = true; wall.receiveShadow = true;
  g.add(wall);
  var roof = new THREE.Mesh(new THREE.ConeGeometry(2.05, 1.35, 4), roofMat);
  roof.position.y = 2.55;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
  var door = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.0, 0.08),
    new THREE.MeshLambertMaterial({ color: 0x5d4037 }));
  door.position.set(0, 0.5, 1.18);
  g.add(door);
  var winMat = new THREE.MeshLambertMaterial({ color: 0xbde3ff, emissive: 0x3b6a8a, emissiveIntensity: 0.35 });
  var w1 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.08), winMat);
  w1.position.set(-0.75, 1.2, 1.18); g.add(w1);
  var w2 = w1.clone(); w2.position.x = 0.75; g.add(w2);
  g.position.set(bx + 0.5, 4, bz + 0.5);
  g.rotation.y = rotY;
  scene.add(g);
}

/* ============================================================
 * 8. Labels, stations, beacon, particles, smoke
 * ============================================================ */
function makeLabel(text, color, small) {
  var cv = document.createElement('canvas');
  cv.width = 400; cv.height = 88;
  var c = cv.getContext('2d');
  c.fillStyle = 'rgba(12,20,36,0.9)';
  var r = 18;
  c.beginPath();
  c.moveTo(r, 4); c.lineTo(400 - r, 4); c.quadraticCurveTo(396, 4, 396, 4 + r);
  c.lineTo(396, 84 - r); c.quadraticCurveTo(396, 84, 396 - r, 84);
  c.lineTo(r, 84); c.quadraticCurveTo(4, 84, 4, 84 - r);
  c.lineTo(4, 4 + r); c.quadraticCurveTo(4, 4, r, 4);
  c.fill();
  c.strokeStyle = color || '#5eead4';
  c.lineWidth = 4;
  c.strokeRect(4, 4, 392, 80);
  c.fillStyle = color || '#5eead4';
  c.font = (small ? 'bold 28px' : 'bold 32px') + ' "Segoe UI",sans-serif';
  c.textAlign = 'center';
  c.fillText(text, 200, 55);
  var tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  var sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthTest: false
  }));
  sprite.scale.set(small ? 3.6 : 4.6, small ? 0.8 : 1.0, 1);
  return sprite;
}

function addStationLabel(key, y) {
  var s = STATIONS[key];
  var spr = makeLabel(L(s.name), '#' + ('000000' + s.color.toString(16)).slice(-6));
  spr.position.set(s.x + 0.5, y || 8.4, s.z + 0.5);
  scene.add(spr);
  labelSprites.push({ key: key, sprite: spr, y: y || 8.4 });
}
function rebuildStationLabels() {
  var i;
  for (i = 0; i < labelSprites.length; i++) {
    scene.remove(labelSprites[i].sprite);
    if (labelSprites[i].sprite.material.map) labelSprites[i].sprite.material.map.dispose();
    labelSprites[i].sprite.material.dispose();
  }
  labelSprites = [];
  for (var key in STATIONS) {
    if (!STATIONS.hasOwnProperty(key)) continue;
    addStationLabel(key, key === 'furnace' ? 9.6 : (key === 'boss' ? 9.0 : 8.4));
  }
}

function makeBrickTexture(base, mortar) {
  var cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  var c = cv.getContext('2d');
  c.fillStyle = mortar || '#5b4636'; c.fillRect(0, 0, 64, 64);
  c.fillStyle = base || '#8a4a32';
  var row, col, off;
  for (row = 0; row < 4; row++) {
    off = (row % 2) * 16;
    for (col = -1; col < 3; col++) {
      c.fillRect(col * 32 + off + 2, row * 16 + 2, 28, 12);
    }
  }
  var tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

/** Cutaway blast furnace — the centrepiece */
function buildFurnaceModel() {
  var g = new THREE.Group();
  var brick = new THREE.MeshLambertMaterial({ map: makeBrickTexture('#8a4a32', '#5b4636') });
  var darkBrick = new THREE.MeshLambertMaterial({ map: makeBrickTexture('#5e4636', '#3f3128') });
  var ironM = new THREE.MeshLambertMaterial({ color: 0x64748b });

  /* stone base */
  var base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.4, 3.4),
    new THREE.MeshLambertMaterial({ color: 0x78716c }));
  base.position.y = 0.2; base.castShadow = true; base.receiveShadow = true;
  g.add(base);

  /* outer shell with a quarter cut away (faces south, toward the plaza) */
  var shell = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.55, 4.6, 22, 1, true, Math.PI * 0.3, Math.PI * 1.55),
    new THREE.MeshLambertMaterial({ map: brick.map, side: THREE.DoubleSide })
  );
  shell.position.y = 2.7;
  shell.castShadow = true;
  g.add(shell);

  /* interior stack — bottom to top: molten iron, slag, glow zone, charge */
  var molten = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.18, 0.55, 18),
    new THREE.MeshLambertMaterial({ color: 0xff5a00, emissive: 0xff3d00, emissiveIntensity: 1.0 }));
  molten.position.y = 0.7; molten.name = 'moltenPool';
  g.add(molten);
  var slag = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.02, 0.22, 18),
    new THREE.MeshLambertMaterial({ color: 0x9aa0a8, emissive: 0x555a60, emissiveIntensity: 0.3 }));
  slag.position.y = 1.08; slag.name = 'slagLayer';
  g.add(slag);
  var glow = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.02, 1.5, 18),
    new THREE.MeshLambertMaterial({ color: 0xb03a1e, emissive: 0xff7b2d, emissiveIntensity: 0.5 }));
  glow.position.y = 1.95; glow.name = 'glowZone';
  g.add(glow);
  var charge = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.02, 1.9, 18),
    new THREE.MeshLambertMaterial({ color: 0x4a3b2f }));
  charge.position.y = 3.6; charge.name = 'chargeLayer';
  g.add(charge);

  /* top rim + hopper */
  var rim = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.12, 8, 22), darkBrick);
  rim.rotation.x = Math.PI / 2; rim.position.y = 5.0;
  g.add(rim);
  var hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 0.7, 10, 1, true), ironM);
  hopper.position.y = 5.45; hopper.rotation.z = 0.18;
  g.add(hopper);

  /* tuyeres (hot air) around lower shell */
  var i, tuy;
  for (i = 0; i < 3; i++) {
    var ang = Math.PI * 0.75 + i * Math.PI * 0.5;
    tuy = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.9, 8), ironM);
    tuy.position.set(Math.sin(ang) * 1.6, 0.85, Math.cos(ang) * 1.6);
    tuy.rotation.z = Math.PI / 2;
    tuy.rotation.y = ang;
    g.add(tuy);
  }

  /* tap-through trough + ingot mould (front-right) */
  var trough = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.3), darkBrick);
  trough.position.set(1.5, 0.42, 0.9);
  trough.rotation.y = -0.5;
  g.add(trough);
  var mould = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x44403c, emissive: 0x000000, emissiveIntensity: 0.6 }));
  mould.position.set(2.15, 0.32, 1.35);
  mould.name = 'ingotMould';
  g.add(mould);

  /* inner glow light */
  var fl = new THREE.PointLight(0xff7b2d, 1.15, 11);
  fl.position.set(0, 1.6, 0.3);
  fl.name = 'furnaceLight';
  g.add(fl);

  return g;
}

function buildStationModel(kind) {
  var g = new THREE.Group();
  var brick = new THREE.MeshLambertMaterial({ map: makeBrickTexture('#8a4a32', '#5b4636') });
  var darkBrick = new THREE.MeshLambertMaterial({ map: makeBrickTexture('#5e4636', '#3f3128') });
  var metal = new THREE.MeshLambertMaterial({ color: 0x94a3b8, emissive: 0x334155, emissiveIntensity: 0.15 });
  var ironM = new THREE.MeshLambertMaterial({ color: 0x64748b });
  var copperM = new THREE.MeshLambertMaterial({ color: 0x16a34a, emissive: 0x14532d, emissiveIntensity: 0.2 });
  var stone = new THREE.MeshLambertMaterial({ color: 0x78716c });
  var m, i;

  if (kind === 'furnace') return buildFurnaceModel();

  if (kind === 'kiln') {
    m = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 1.4, 14), darkBrick);
    m.position.y = 0.7; m.castShadow = true; g.add(m);
    m = new THREE.Mesh(new THREE.SphereGeometry(1.08, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), brick);
    m.position.y = 1.4; m.castShadow = true; g.add(m);
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 1.3, 8), darkBrick);
    m.position.set(0.55, 2.4, 0.2); m.castShadow = true; g.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.22), new THREE.MeshBasicMaterial({ color: 0x1c1917 }));
    m.position.set(0, 0.55, 1.22); g.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.16),
      new THREE.MeshBasicMaterial({ color: 0xea580c }));
    m.position.set(0, 0.4, 1.28); m.name = 'kilnGlow'; g.add(m);
  } else if (kind === 'copper') {
    m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 1.3), new THREE.MeshLambertMaterial({ color: 0x6d4c33 }));
    m.position.y = 0.95; m.castShadow = true; g.add(m);
    var legPos = [[-0.9, -0.45], [0.9, -0.45], [-0.9, 0.45], [0.9, 0.45]];
    for (i = 0; i < 4; i++) {
      m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.2), darkBrick);
      m.position.set(legPos[i][0], 0.45, legPos[i][1]);
      g.add(m);
    }
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.9, 14), copperM);
    m.position.set(0.2, 0.55, -1.1); m.castShadow = true; g.add(m);
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.14, 14),
      new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.7 }));
    m.position.set(0.2, 1.02, -1.1); g.add(m);
    m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), copperM);
    m.position.set(-0.7, 1.25, 0.15); m.castShadow = true; g.add(m);
    m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), copperM);
    m.position.set(-0.4, 1.2, 0.35); g.add(m);
  } else if (kind === 'generator') {
    m = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 1.25), darkBrick);
    m.position.y = 0.42; m.castShadow = true; g.add(m);
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.5, 12), metal);
    m.rotation.z = Math.PI / 2; m.position.set(0, 1.15, 0); m.castShadow = true; g.add(m);
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.3, 8), darkBrick);
    m.position.set(-0.5, 1.9, 0); m.castShadow = true; g.add(m);
    /* flywheel */
    var wheel = new THREE.Group();
    wheel.name = 'genWheel';
    var rimW = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 8, 20),
      new THREE.MeshLambertMaterial({ color: 0xd9a441, emissive: 0x8a5a10, emissiveIntensity: 0.25 }));
    wheel.add(rimW);
    for (i = 0; i < 3; i++) {
      m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.0, 0.06), ironM);
      m.rotation.z = i * Math.PI / 3;
      wheel.add(m);
    }
    wheel.position.set(0.95, 1.15, 0);
    wheel.rotation.y = Math.PI / 2;
    g.add(wheel);
    generatorWheel = wheel;
    /* coils */
    for (i = 0; i < 3; i++) {
      m = new THREE.Mesh(new THREE.TorusGeometry(0.3 - i * 0.05, 0.045, 6, 16),
        new THREE.MeshLambertMaterial({ color: 0xc2703d, emissive: 0x7c3f16, emissiveIntensity: 0.3 }));
      m.position.set(-0.2 + i * 0.25, 1.15, 0.68);
      g.add(m);
    }
  } else if (kind === 'cell') {
    /* steel shell */
    m = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.15, 1.7),
      new THREE.MeshLambertMaterial({ color: 0x4b5563 }));
    m.position.y = 0.58; m.castShadow = true; m.receiveShadow = true; g.add(m);
    /* molten interior */
    m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.4),
      new THREE.MeshLambertMaterial({ color: 0xff6a00, emissive: 0xff5100, emissiveIntensity: 0.95 }));
    m.position.y = 1.16; m.name = 'cellMolten'; g.add(m);
    /* carbon electrodes */
    for (i = -1; i <= 1; i++) {
      m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.6, 8),
        new THREE.MeshLambertMaterial({ color: 0x1f242b }));
      m.position.set(i * 0.75, 1.95, 0);
      m.castShadow = true;
      g.add(m);
    }
    /* busbar */
    m = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.14, 0.18),
      new THREE.MeshLambertMaterial({ color: 0x22d3ee, emissive: 0x0e7490, emissiveIntensity: 0.7 }));
    m.position.set(0, 2.78, 0);
    g.add(m);
    /* cryolite heap + sign */
    m = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.6, 8),
      new THREE.MeshLambertMaterial({ color: 0xdbeafe }));
    m.position.set(1.9, 0.3, 0.7); m.castShadow = true; g.add(m);
    var cryoSign = makeLabel('Cryolite · 冰晶石', '#a5f3fc', true);
    cryoSign.position.set(1.9, 1.35, 0.7);
    g.add(cryoSign);
    /* arc sprites */
    var arcTex = makeGlowTexture(0x67e8f9);
    for (i = 0; i < 2; i++) {
      var arc = new THREE.Sprite(new THREE.SpriteMaterial({
        map: arcTex, transparent: true, opacity: 0.75, depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      arc.scale.set(0.6, 0.6, 1);
      arc.position.set(-0.37 + i * 0.75, 1.35, 0);
      g.add(arc);
      cellArcSprites.push(arc);
    }
  } else if (kind === 'craft') {
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.82, 0.75, 12),
      new THREE.MeshLambertMaterial({ color: 0x6d4c33 }));
    m.position.y = 0.37; m.castShadow = true; g.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 0.55), ironM);
    m.position.y = 0.92; m.castShadow = true; g.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.45), ironM);
    m.position.set(-0.55, 0.9, 0); g.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.35), ironM);
    m.position.set(0.55, 0.87, 0); g.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), new THREE.MeshLambertMaterial({ color: 0x6d4c33 }));
    m.position.set(0.35, 1.3, 0.35); m.rotation.z = -0.5; g.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.22), metal);
    m.position.set(0.56, 1.52, 0.45); g.add(m);
  } else if (kind === 'monument') {
    m = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 2.0), stone);
    m.position.y = 0.25; m.castShadow = true; m.receiveShadow = true; g.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.7, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xa8a29e }));
    m.position.y = 1.85; m.castShadow = true; g.add(m);
    /* metal badges */
    var badgeCols = { gold: 0xfbbf24, copper: 0xc2703d, silver: 0xd6d9de, iron: 0x8b939e, aluminium: 0x67e8f9 };
    var keysM = ['gold', 'copper', 'silver', 'iron', 'aluminium'];
    for (i = 0; i < 5; i++) {
      m = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 14),
        new THREE.MeshLambertMaterial({ color: badgeCols[keysM[i]], emissive: badgeCols[keysM[i]], emissiveIntensity: 0.08 }));
      m.rotation.x = Math.PI / 2;
      m.position.set(-0.8 + i * 0.4, 2.55, 0.24);
      m.name = 'badge_' + keysM[i];
      g.add(m);
    }
    m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.1),
      new THREE.MeshLambertMaterial({ color: 0x78716c }));
    m.position.set(0, 1.0, 0.22);
    g.add(m);
  } else if (kind === 'boss') {
    m = new THREE.Mesh(new THREE.BoxGeometry(0.75, 3.4, 0.75), stone);
    m.position.set(-1.5, 1.7, 0); m.castShadow = true; g.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(0.75, 3.4, 0.75), stone);
    m.position.set(1.5, 1.7, 0); m.castShadow = true; g.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.65, 0.8), stone);
    m.position.y = 3.6; m.castShadow = true; g.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.7, 0.16),
      new THREE.MeshLambertMaterial({ color: 0x7c3aed, emissive: 0x4c1d95, emissiveIntensity: 0.4 }));
    m.position.set(0, 1.35, 0);
    g.add(m);
    m = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshBasicMaterial({ color: 0xc084fc }));
    m.position.set(0, 4.35, 0);
    m.name = 'bossCrystal';
    g.add(m);
  }
  return g;
}

function makeGlowTexture(colorHex) {
  var cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  var c = cv.getContext('2d');
  var col = new THREE.Color(colorHex);
  var css = 'rgba(' + Math.round(col.r * 255) + ',' + Math.round(col.g * 255) + ',' + Math.round(col.b * 255) + ',';
  var grd = c.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, css + '1)');
  grd.addColorStop(0.4, css + '0.5)');
  grd.addColorStop(1, css + '0)');
  c.fillStyle = grd;
  c.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

function addStations() {
  var key, s, ring, model;
  for (key in STATIONS) {
    if (!STATIONS.hasOwnProperty(key)) continue;
    s = STATIONS[key];
    model = buildStationModel(key);
    model.position.set(s.x + 0.5, 4.0, s.z + 0.5);
    scene.add(model);
    stationModels[key] = model;

    ring = new THREE.Mesh(
      new THREE.RingGeometry(s.r - 0.35, s.r, 48),
      new THREE.MeshBasicMaterial({ color: s.color, side: THREE.DoubleSide, transparent: true, opacity: 0.4 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(s.x + 0.5, 4.06, s.z + 0.5);
    scene.add(ring);

    addStationLabel(key, key === 'furnace' ? 9.6 : (key === 'boss' ? 9.0 : 8.4));
  }

  /* beacon (quest marker) */
  beaconMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 18, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8, transparent: true, opacity: 0.16,
      side: THREE.DoubleSide, depthWrite: false
    })
  );
  beaconMesh.visible = false;
  scene.add(beaconMesh);
}

function setBeacon(stationKey) {
  beaconStationKey = stationKey;
  if (!beaconMesh) return;
  if (!stationKey || !STATIONS[stationKey]) {
    beaconMesh.visible = false;
    return;
  }
  var s = STATIONS[stationKey];
  beaconMesh.position.set(s.x + 0.5, 13, s.z + 0.5);
  beaconMesh.material.color.setHex(s.color);
  beaconMesh.visible = true;
}

/* --- particles & smoke --- */
function spawnMineBurst(x, y, z, color) {
  if (particles.length > 220) return;
  var i, m, ang, sp;
  for (i = 0; i < 7; i++) {
    m = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.12),
      new THREE.MeshBasicMaterial({ color: color })
    );
    m.position.set(x + 0.5, y + 0.5, z + 0.5);
    scene.add(m);
    ang = Math.random() * Math.PI * 2;
    sp = 1.5 + Math.random() * 2;
    particles.push({
      mesh: m,
      vx: Math.cos(ang) * sp * 0.35,
      vy: 1.2 + Math.random() * 1.5,
      vz: Math.sin(ang) * sp * 0.35,
      rot: (Math.random() - 0.5) * 8,
      life: 0.35 + Math.random() * 0.22
    });
  }
}
function spawnGlowBurst(x, y, z, colorHex, n) {
  if (particles.length > 220) return;
  var tex = makeGlowTexture(colorHex);
  var i, spr;
  for (i = 0; i < (n || 10); i++) {
    spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0.95, depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    spr.scale.setScalar(0.28 + Math.random() * 0.3);
    spr.position.set(x, y, z);
    scene.add(spr);
    var ang = Math.random() * Math.PI * 2;
    var sp = 0.8 + Math.random() * 2.2;
    particles.push({
      mesh: spr,
      vx: Math.cos(ang) * sp * 0.4,
      vy: 0.8 + Math.random() * 2.2,
      vz: Math.sin(ang) * sp * 0.4,
      rot: 0,
      life: 0.4 + Math.random() * 0.35,
      sprite: true
    });
  }
}
function updateParticles() {
  var i, p;
  for (i = particles.length - 1; i >= 0; i--) {
    p = particles[i];
    p.life -= dt;
    p.vy -= 6 * dt;
    p.mesh.position.x += p.vx * dt * 8;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt * 8;
    if (!p.sprite && p.rot) p.mesh.rotation.y += p.rot * dt;
    if (p.sprite) p.mesh.material.opacity = Math.max(0, p.life * 1.8);
    if (p.life <= 0) {
      scene.remove(p.mesh);
      if (p.mesh.geometry) p.mesh.geometry.dispose();
      if (p.mesh.material) {
        if (p.mesh.material.map) p.mesh.material.map.dispose();
        p.mesh.material.dispose();
      }
      particles.splice(i, 1);
    }
  }
}

var smokeTex = null;
var smokeEmitters = [];
function getSmokeTex() {
  if (smokeTex) return smokeTex;
  var cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  var c = cv.getContext('2d');
  var g = c.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, 'rgba(235,235,235,0.85)');
  g.addColorStop(0.6, 'rgba(210,210,215,0.4)');
  g.addColorStop(1, 'rgba(200,200,205,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  smokeTex = new THREE.CanvasTexture(cv);
  return smokeTex;
}
function spawnSmoke(x, y, z, warm) {
  if (smokes.length > 44) return;
  var spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getSmokeTex(),
    color: warm ? 0xf7c8a0 : 0xd7dade,
    transparent: true, opacity: 0.5, depthWrite: false
  }));
  spr.position.set(x + (Math.random() - 0.5) * 0.25, y, z + (Math.random() - 0.5) * 0.25);
  spr.scale.setScalar(0.35 + Math.random() * 0.25);
  scene.add(spr);
  smokes.push({
    spr: spr,
    vy: 0.55 + Math.random() * 0.4,
    drift: (Math.random() - 0.5) * 0.25,
    life: 2.2 + Math.random() * 1.4,
    t: 0
  });
}
function updateSmokes() {
  var i, s;
  for (i = smokes.length - 1; i >= 0; i--) {
    s = smokes[i];
    s.t += dt;
    s.spr.position.y += s.vy * dt;
    s.spr.position.x += s.drift * dt;
    s.spr.scale.setScalar(0.35 + s.t * 0.55);
    s.spr.material.opacity = Math.max(0, 0.5 * (1 - s.t / s.life));
    if (s.t >= s.life) {
      scene.remove(s.spr);
      s.spr.material.dispose();
      smokes.splice(i, 1);
    }
  }
}
var smokeAcc = 0;
function emitStationSmoke() {
  smokeAcc += dt;
  if (smokeAcc < 0.16) return;
  smokeAcc = 0;
  /* kiln chimney */
  spawnSmoke(STATIONS.kiln.x + 1.05, 7.2, STATIONS.kiln.z + 0.7, true);
  /* furnace top */
  spawnSmoke(STATIONS.furnace.x + 0.5, 9.9, STATIONS.furnace.z + 0.5, true);
  if (Math.random() < 0.4) spawnSmoke(STATIONS.furnace.x + 0.5, 9.9, STATIONS.furnace.z + 0.5, false);
  /* generator stack */
  spawnSmoke(STATIONS.generator.x, 7.1, STATIONS.generator.z + 0.5, false);
}

/* damage floats */
function spawnDmgNumber(x, y, z, amount, isHeal) {
  var cv = document.createElement('canvas');
  cv.width = 128; cv.height = 64;
  var c = cv.getContext('2d');
  c.font = 'bold 42px "Segoe UI",sans-serif';
  c.textAlign = 'center';
  c.lineWidth = 6;
  c.strokeStyle = '#000';
  c.fillStyle = isHeal ? '#4ade80' : '#f87171';
  var text = (isHeal ? '+' : '−') + Math.abs(amount);
  c.strokeText(text, 64, 46);
  c.fillText(text, 64, 46);
  var spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false
  }));
  spr.scale.set(1.4, 0.7, 1);
  spr.position.set(x, y, z);
  scene.add(spr);
  dmgFloats.push({ mesh: spr, life: 1.0, vy: 1.6 });
}
function updateDmgFloats() {
  var i, d;
  for (i = dmgFloats.length - 1; i >= 0; i--) {
    d = dmgFloats[i];
    d.life -= dt;
    d.mesh.position.y += d.vy * dt;
    d.mesh.material.opacity = Math.max(0, d.life);
    if (d.life <= 0) {
      scene.remove(d.mesh);
      if (d.mesh.material.map) d.mesh.material.map.dispose();
      d.mesh.material.dispose();
      dmgFloats.splice(i, 1);
    }
  }
}

/* --- minimap --- */
function buildMinimapBase() {
  var cv = document.createElement('canvas');
  cv.width = 170; cv.height = 170;
  var c = cv.getContext('2d');
  var k = 170 / WX;
  c.fillStyle = '#3e6b2f';
  c.fillRect(0, 0, 170, 170);
  /* forest */
  c.fillStyle = '#2e5524';
  c.fillRect(8 * k, 0, 24 * k, 11 * k);
  /* haematite west */
  c.fillStyle = 'rgba(150,60,35,0.55)';
  c.fillRect(0, 8 * k, 14 * k, 24 * k);
  /* copper east */
  c.fillStyle = 'rgba(30,110,70,0.6)';
  c.fillRect(26 * k, 8 * k, 14 * k, 22 * k);
  /* limestone NW */
  c.fillStyle = 'rgba(215,210,190,0.7)';
  c.fillRect(0, 29 * k, 14 * k, 11 * k);
  /* bauxite fringe */
  c.fillStyle = 'rgba(170,105,60,0.5)';
  c.fillRect(29 * k, 23 * k, 11 * k, 15 * k);
  /* plaza */
  c.fillStyle = '#c9a86f';
  c.fillRect(16 * k, 14 * k, 9 * k, 9 * k);
  /* boss arena */
  c.fillStyle = '#6d5a86';
  c.fillRect(15 * k, 28 * k, 11 * k, 10 * k);
  /* pond */
  c.fillStyle = '#3b82c4';
  c.beginPath();
  c.arc((pondCenter.x + 0.5) * k, (pondCenter.z + 0.5) * k, 2.4 * k, 0, Math.PI * 2);
  c.fill();
  minimapBase = cv;
}
function drawMinimap() {
  if (!minimapCtx || !minimapBase) return;
  var c = minimapCtx;
  var k = 170 / WX;
  c.clearRect(0, 0, 170, 170);
  c.drawImage(minimapBase, 0, 0);
  var key, s;
  for (key in STATIONS) {
    if (!STATIONS.hasOwnProperty(key)) continue;
    s = STATIONS[key];
    c.fillStyle = '#' + ('000000' + s.color.toString(16)).slice(-6);
    c.beginPath();
    c.arc((s.x + 0.5) * k, (s.z + 0.5) * k, key === 'boss' ? 5 : 4, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.lineWidth = 1;
    c.stroke();
  }
  /* player arrow */
  c.save();
  c.translate(player.x * k, player.z * k);
  c.rotate(-yaw + Math.PI);
  c.fillStyle = '#ffffff';
  c.strokeStyle = '#0f172a';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(0, -6);
  c.lineTo(4.4, 4.6);
  c.lineTo(-4.4, 4.6);
  c.closePath();
  c.fill();
  c.stroke();
  c.restore();
}

/* ============================================================
 * 9. Characters (player + boss + weapons)
 * ============================================================ */
function createPlayerCharacter() {
  var g = new THREE.Group();
  var skin = 0xf1c27d, shirt = 0x0f766e, pants = 0x1e3a5f, shoe = 0x292524;
  var armourCol = 0xa8b0bc, armourEdge = 0x64748b;

  var torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), new THREE.MeshLambertMaterial({ color: shirt }));
  torso.position.y = 1.05; torso.castShadow = true;
  g.add(torso);
  var head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.65; head.castShadow = true;
  g.add(head);
  var hat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46), new THREE.MeshLambertMaterial({ color: 0x134e4a }));
  hat.position.y = 1.9; g.add(hat);

  var armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), new THREE.MeshLambertMaterial({ color: shirt }));
  armL.position.set(-0.4, 1.05, 0); armL.name = 'armL'; armL.castShadow = true;
  g.add(armL);
  var armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), new THREE.MeshLambertMaterial({ color: shirt }));
  armR.position.set(0.4, 1.05, 0); armR.name = 'armR'; armR.castShadow = true;
  g.add(armR);

  var armour = new THREE.Group();
  armour.name = 'armourMesh';
  armour.visible = false;
  var chest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.4),
    new THREE.MeshLambertMaterial({ color: armourCol, emissive: armourEdge, emissiveIntensity: 0.2 }));
  chest.position.y = 1.1; armour.add(chest);
  var plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.12),
    new THREE.MeshLambertMaterial({ color: 0xcbd5e1, emissive: 0x94a3b8, emissiveIntensity: 0.25 }));
  plate.position.set(0, 1.15, 0.22); armour.add(plate);
  var shL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.28),
    new THREE.MeshLambertMaterial({ color: armourCol, emissive: armourEdge, emissiveIntensity: 0.15 }));
  shL.position.set(-0.42, 1.35, 0); armour.add(shL);
  var shR = shL.clone(); shR.position.x = 0.42; armour.add(shR);
  var helm = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.2, 0.48), new THREE.MeshLambertMaterial({ color: armourCol }));
  helm.position.y = 1.92; armour.add(helm);
  var badge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.04), new THREE.MeshBasicMaterial({ color: 0x67e8f9 }));
  badge.position.set(0, 1.15, 0.28); armour.add(badge);
  g.add(armour);

  var weaponHold = new THREE.Group();
  weaponHold.name = 'weaponHold';
  weaponHold.position.set(0.42, 0.78, 0.12);
  g.add(weaponHold);

  var legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.22), new THREE.MeshLambertMaterial({ color: pants }));
  legL.position.set(-0.14, 0.35, 0); legL.name = 'legL'; legL.castShadow = true;
  g.add(legL);
  var legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.22), new THREE.MeshLambertMaterial({ color: pants }));
  legR.position.set(0.14, 0.35, 0); legR.name = 'legR'; legR.castShadow = true;
  g.add(legR);
  var footL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.3), new THREE.MeshLambertMaterial({ color: shoe }));
  footL.position.set(-0.14, 0.06, 0.04); g.add(footL);
  var footR = footL.clone(); footR.position.x = 0.14; g.add(footR);

  return g;
}

function makeWeaponMesh(w) {
  var g = new THREE.Group();
  var tier = (w && w.tier) || 'copper';
  var bladeCol = 0xf59e0b, hiltCol = 0x92400e, emit = 0.15;
  if (tier === 'iron') { bladeCol = 0xcbd5e1; hiltCol = 0x334155; }
  else if (tier === 'silver') { bladeCol = 0xe5e7eb; hiltCol = 0x64748b; emit = 0.28; }
  else if (tier === 'gold') { bladeCol = 0xfbbf24; hiltCol = 0xb45309; emit = 0.4; }
  var m, blade, guard, grip;
  if (!w) return g;
  if (w.type === 'sword') {
    grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), new THREE.MeshLambertMaterial({ color: hiltCol }));
    grip.position.y = -0.1; g.add(grip);
    guard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.08),
      new THREE.MeshLambertMaterial({ color: tier === 'gold' ? 0xfde68a : 0xfbbf24 }));
    guard.position.y = 0.06; g.add(guard);
    blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 0.04),
      new THREE.MeshLambertMaterial({ color: bladeCol, emissive: bladeCol, emissiveIntensity: emit }));
    blade.position.y = 0.5; g.add(blade);
    m = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), new THREE.MeshLambertMaterial({ color: bladeCol }));
    m.position.y = 0.98; g.add(m);
  } else if (w.type === 'knife') {
    grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.07), new THREE.MeshLambertMaterial({ color: hiltCol }));
    grip.position.y = -0.06; g.add(grip);
    blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.03),
      new THREE.MeshLambertMaterial({ color: bladeCol, emissive: bladeCol, emissiveIntensity: emit }));
    blade.position.y = 0.28; g.add(blade);
  } else if (w.type === 'bow') {
    var bowCol = tier === 'gold' ? 0xeab308 : (tier === 'silver' ? 0x94a3b8 : (tier === 'iron' ? 0x64748b : 0xb45309));
    m = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.035, 6, 16, Math.PI),
      new THREE.MeshLambertMaterial({ color: bowCol, emissive: bowCol, emissiveIntensity: emit * 0.5 }));
    m.rotation.y = Math.PI / 2; m.rotation.z = Math.PI / 2; g.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.72, 0.02), new THREE.MeshBasicMaterial({ color: 0xe7e5e4 }));
    m.position.z = 0.02; g.add(m);
    blade = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 5), new THREE.MeshLambertMaterial({ color: 0xd6d3d1 }));
    blade.rotation.x = Math.PI / 2; blade.position.set(0, 0, 0.35); blade.name = 'arrowVis'; g.add(blade);
    m = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 5), new THREE.MeshLambertMaterial({ color: bladeCol }));
    m.rotation.x = Math.PI / 2; m.position.set(0, 0, 0.72); g.add(m);
  }
  return g;
}

function refreshHeldWeapon(force) {
  if (!playerRig) return;
  var hold = playerRig.getObjectByName('weaponHold');
  if (!hold) return;
  var w = getWeapon();
  var id = w ? w.id : null;
  if (!force && id === equippedWeaponId) return;
  while (hold.children.length) {
    var c = hold.children[0];
    hold.remove(c);
    c.traverse(function (ch) {
      if (ch.geometry) ch.geometry.dispose();
      if (ch.material) {
        if (ch.material.map) ch.material.map.dispose();
        ch.material.dispose();
      }
    });
  }
  equippedWeaponId = id;
  if (!w) return;
  var mesh = makeWeaponMesh(w);
  if (w.type === 'bow') {
    mesh.rotation.set(0.2, 0, -0.2); mesh.position.set(0.05, -0.15, 0.15); mesh.scale.set(1.15, 1.15, 1.15);
  } else if (w.type === 'knife') {
    mesh.rotation.set(-0.2, 0, 0.15); mesh.position.set(0.02, -0.35, 0.08); mesh.scale.set(1.2, 1.2, 1.2);
  } else {
    mesh.rotation.set(-0.15, 0.1, 0.2); mesh.position.set(0.02, -0.4, 0.1); mesh.scale.set(1.15, 1.15, 1.15);
  }
  hold.add(mesh);
}

function createBossMonster() {
  var g = new THREE.Group();
  var bodyCol = 0x5b21b6, dark = 0x3b0764, glow = 0xf97316, claw = 0x1c1917;
  var body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.0, 1.4),
    new THREE.MeshLambertMaterial({ color: bodyCol, emissive: dark, emissiveIntensity: 0.25 }));
  body.position.y = 1.4; body.name = 'body'; body.castShadow = true;
  g.add(body);
  var belly = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x7c3aed, emissive: glow, emissiveIntensity: 0.35 }));
  belly.position.set(0, 1.2, 0.55); g.add(belly);
  var head = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 1.2),
    new THREE.MeshLambertMaterial({ color: bodyCol, emissive: dark, emissiveIntensity: 0.2 }));
  head.position.y = 2.85; head.name = 'head'; head.castShadow = true;
  g.add(head);
  var hornL = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 6), new THREE.MeshLambertMaterial({ color: claw }));
  hornL.position.set(-0.45, 3.55, 0); hornL.rotation.z = 0.35; g.add(hornL);
  var hornR = hornL.clone(); hornR.position.x = 0.45; hornR.rotation.z = -0.35; g.add(hornR);
  var eyeMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
  var eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), eyeMat);
  eyeL.position.set(-0.32, 2.95, 0.55); g.add(eyeL);
  var eyeR = eyeL.clone(); eyeR.position.x = 0.32; g.add(eyeR);
  var jaw = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.5), new THREE.MeshLambertMaterial({ color: dark }));
  jaw.position.set(0, 2.45, 0.45); g.add(jaw);
  var fangL = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 5), new THREE.MeshLambertMaterial({ color: 0xf5f5f4 }));
  fangL.position.set(-0.2, 2.25, 0.65); fangL.rotation.x = Math.PI; g.add(fangL);
  var fangR = fangL.clone(); fangR.position.x = 0.2; g.add(fangR);
  var armL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.4, 0.45), new THREE.MeshLambertMaterial({ color: bodyCol }));
  armL.position.set(-1.25, 1.5, 0); armL.name = 'armL'; armL.castShadow = true;
  g.add(armL);
  var armR = armL.clone(); armR.position.x = 1.25; armR.name = 'armR'; g.add(armR);
  var clawL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.7), new THREE.MeshLambertMaterial({ color: claw }));
  clawL.position.set(-1.25, 0.7, 0.2); g.add(clawL);
  var clawR = clawL.clone(); clawR.position.x = 1.25; g.add(clawR);
  var legL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.55), new THREE.MeshLambertMaterial({ color: dark }));
  legL.position.set(-0.45, 0.5, 0); g.add(legL);
  var legR = legL.clone(); legR.position.x = 0.45; g.add(legR);
  var sp, si;
  for (si = 0; si < 4; si++) {
    sp = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.45, 5), new THREE.MeshLambertMaterial({ color: 0xa855f7 }));
    sp.position.set(0, 1.6 + si * 0.35, -0.75);
    sp.rotation.x = -0.6;
    g.add(sp);
  }
  return g;
}

/* ============================================================
 * 10. Camera, movement, mining, combat
 * ============================================================ */
function flatForward() { return { x: Math.sin(yaw), z: -Math.cos(yaw) }; }
function lookDir() {
  var cp = Math.cos(pitch);
  return new THREE.Vector3(Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
}

function setAimZoom(on, quiet) {
  var w = getWeapon();
  var aimBtn = $('btnTouchAim');
  if (on) {
    if (phase !== 'boss') {
      if (!quiet) toast(t('aimOnlyBoss'));
      return false;
    }
    if (!w || w.type !== 'bow') {
      if (!quiet) toast(t('equipBowFirst'));
      return false;
    }
    aimZoom = true;
    $('crosshair').classList.add('aim', 'show');
    $('aimBanner').classList.add('show');
    if (aimBtn) aimBtn.classList.add('on');
    if (!quiet) toast(touchMode ? t('aimToastTouch') : t('aimToastPC'), 1200);
    return true;
  }
  aimZoom = false;
  aimToggleLock = false;
  $('crosshair').classList.remove('aim');
  $('aimBanner').classList.remove('show');
  if (aimBtn) aimBtn.classList.remove('on');
  return true;
}

function updateCamera() {
  var dist = aimZoom ? 2.4 : CAM_DIST;
  var height = aimZoom ? 1.85 : CAM_HEIGHT;
  var cp = Math.cos(pitch), sp = Math.sin(pitch);
  var ox = Math.sin(yaw) * cp, oy = sp, oz = -Math.cos(yaw) * cp;
  var lookY = player.y + (aimZoom ? 1.45 : 1.35);
  var side = aimZoom ? 0.55 : 0;
  var rx = Math.cos(yaw) * side, rz = Math.sin(yaw) * side;

  var desired = new THREE.Vector3(
    player.x - ox * dist + rx,
    player.y + height - oy * dist * 0.55,
    player.z - oz * dist + rz
  );
  if (desired.y < player.y + 0.6) desired.y = player.y + 0.6;

  var i, tt, bx, by, bz, pivotY = lookY;
  for (i = 0; i < 10; i++) {
    tt = i / 10;
    bx = player.x + (desired.x - player.x) * tt;
    by = pivotY + (desired.y - pivotY) * tt;
    bz = player.z + (desired.z - player.z) * tt;
    if (isSolid(getB(bx, by, bz))) {
      var pull = Math.max(0.12, tt - 0.1);
      desired.set(
        player.x + (desired.x - player.x) * pull,
        pivotY + (desired.y - pivotY) * pull,
        player.z + (desired.z - player.z) * pull
      );
      break;
    }
  }

  if (!camSmoothPos) camSmoothPos = desired.clone();
  var k = 1 - Math.exp(-CAM_SMOOTH * dt);
  camSmoothPos.x += (desired.x - camSmoothPos.x) * k;
  camSmoothPos.y += (desired.y - camSmoothPos.y) * k;
  camSmoothPos.z += (desired.z - camSmoothPos.z) * k;
  camera.position.copy(camSmoothPos);

  if (shakeT > 0) {
    camera.position.x += (Math.random() - 0.5) * shakeT * 0.55;
    camera.position.y += (Math.random() - 0.5) * shakeT * 0.4;
    camera.position.z += (Math.random() - 0.5) * shakeT * 0.55;
    shakeT = Math.max(0, shakeT - dt * 1.6);
  }

  var targetFov = aimZoom ? AIM_FOV : BASE_FOV;
  currentFov += (targetFov - currentFov) * Math.min(1, 10 * dt);
  if (camera.fov !== currentFov) {
    camera.fov = currentFov;
    camera.updateProjectionMatrix();
  }

  if (aimZoom) {
    var dir = lookDir();
    camera.lookAt(player.x + dir.x * 12, lookY + dir.y * 12, player.z + dir.z * 12);
  } else {
    camera.lookAt(player.x, lookY, player.z);
  }
}

function updatePlayerVisual(moving) {
  if (!playerRig) return;
  playerRig.position.set(player.x, player.y, player.z);
  if (aimZoom || (!moving && (phase === 'play' || phase === 'boss'))) player.facing = yaw;
  playerRig.rotation.y = player.facing;

  var armL = playerRig.getObjectByName('armL');
  var armR = playerRig.getObjectByName('armR');
  var legL = playerRig.getObjectByName('legL');
  var legR = playerRig.getObjectByName('legR');
  var hold = playerRig.getObjectByName('weaponHold');
  var w = getWeapon();
  if ((w ? w.id : null) !== equippedWeaponId) refreshHeldWeapon();

  var swinging = swingState.active && swingState.t < swingDur;
  var sp2 = swinging ? Math.min(1, swingState.t / swingDur) : 0;

  if (aimZoom && w && w.type === 'bow') {
    if (armL) { armL.rotation.x = -1.15; armL.rotation.z = 0.45; }
    if (armR) { armR.rotation.x = -0.95; armR.rotation.z = -0.35; }
    if (hold) hold.rotation.set(-0.55, 0.4, 0.1);
  } else if (swinging) {
    var raise = Math.sin(sp2 * Math.PI);
    if (armR) {
      armR.rotation.x = -1.4 + sp2 * 2.4;
      armR.rotation.z = -1.1 + sp2 * 2.0;
      armR.rotation.y = sp2 * 0.6;
    }
    if (armL) { armL.rotation.x = -0.3; armL.rotation.z = 0.2; }
    if (hold) hold.rotation.set(-0.3 + sp2 * 1.4, sp2 * 0.8, -0.5 + sp2 * 1.6);
    if (legL) legL.rotation.x = 0.15;
    if (legR) legR.rotation.x = -0.1;
    updateSlashTrail(sp2, raise);
  } else if (moving) {
    walkPhase += 10 * dt;
    var s = Math.sin(walkPhase) * 0.55;
    if (legL) legL.rotation.x = s;
    if (legR) legR.rotation.x = -s;
    if (armL) { armL.rotation.x = -s * 0.7; armL.rotation.z = 0; armL.rotation.y = 0; }
    if (armR) { armR.rotation.x = s * 0.7; armR.rotation.z = 0; armR.rotation.y = 0; }
    if (hold) hold.rotation.set(0, 0, 0);
    hideSlashTrail();
  } else {
    walkPhase *= Math.pow(0.001, dt);
    if (legL) legL.rotation.x *= 0.7;
    if (legR) legR.rotation.x *= 0.7;
    if (armL) { armL.rotation.x *= 0.7; armL.rotation.z *= 0.7; armL.rotation.y = 0; }
    if (armR) {
      var idleRaise = w ? 0.4 : 0;
      armR.rotation.x = -idleRaise;
      armR.rotation.z *= 0.7;
      armR.rotation.y = 0;
    }
    if (hold) hold.rotation.set(0, 0, 0);
    hideSlashTrail();
  }
}

function ensureSlashTrail() {
  if (slashMesh) return;
  slashMesh = new THREE.Mesh(
    new THREE.TorusGeometry(1.1, 0.06, 6, 20, Math.PI * 0.9),
    new THREE.MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  slashMesh.visible = false;
  scene.add(slashMesh);
}
function updateSlashTrail(sp2, raise) {
  ensureSlashTrail();
  slashMesh.visible = true;
  slashMesh.position.set(
    player.x + Math.sin(player.facing) * 0.9,
    player.y + 1.2 + raise * 0.3,
    player.z + Math.cos(player.facing) * 0.9
  );
  slashMesh.rotation.set(0.4, player.facing, sp2 * 1.8 - 0.6);
  slashMesh.material.opacity = 0.9 * Math.sin(sp2 * Math.PI);
  slashMesh.scale.setScalar(0.7 + sp2 * 0.6);
}
function hideSlashTrail() { if (slashMesh) slashMesh.visible = false; }

function updateSwingCombat() {
  if (!swingState.active) return;
  swingState.t += dt;
  if (!swingState.hitDone && swingState.t >= swingDur * 0.38) {
    swingState.hitDone = true;
    applyMeleeHit();
  }
  if (swingState.t >= swingDur) {
    swingState.active = false;
    hideSlashTrail();
  }
}

function collides(px, py, pz) {
  var minX = px - PLAYER_R, maxX = px + PLAYER_R;
  var minY = py, maxY = py + PLAYER_H - 0.01;
  var minZ = pz - PLAYER_R, maxZ = pz + PLAYER_R;
  var x0 = Math.floor(minX), x1 = Math.floor(maxX);
  var y0 = Math.floor(minY), y1 = Math.floor(maxY);
  var z0 = Math.floor(minZ), z1 = Math.floor(maxZ);
  var x, y, z;
  for (x = x0; x <= x1; x++) {
    for (y = y0; y <= y1; y++) {
      for (z = z0; z <= z1; z++) {
        if (isSolid(getB(x, y, z))) return true;
      }
    }
  }
  return false;
}

function raycastBlock(maxDist) {
  maxDist = maxDist || MINE_RANGE;
  var dir = lookDir();
  var ox = player.x, oy = player.y + 1.45, oz = player.z;
  var tt, x, y, z, b, prevX = -1, prevY = -1, prevZ = -1;
  for (tt = 0.2; tt < maxDist; tt += 0.08) {
    x = Math.floor(ox + dir.x * tt);
    y = Math.floor(oy + dir.y * tt);
    z = Math.floor(oz + dir.z * tt);
    if (x === prevX && y === prevY && z === prevZ) continue;
    prevX = x; prevY = y; prevZ = z;
    b = getB(x, y, z);
    if (b !== BLOCK.AIR && b !== BLOCK.LEAF) return { x: x, y: y, z: z, b: b, hit: true, dist: tt };
  }
  return { hit: false };
}

function ensureHighlight() {
  if (highlightMesh) return;
  highlightMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 1.05, 1.05),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false })
  );
  var edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.06, 1.06, 1.06)),
    new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.95 })
  );
  highlightMesh.add(edges);
  highlightMesh.visible = false;
  scene.add(highlightMesh);
}

function blockLabel(b) {
  if (b === BLOCK.HAEMATITE) return t('lb_haematite');
  if (b === BLOCK.COPPER_ORE) return t('lb_copper');
  if (b === BLOCK.LIMESTONE) return t('lb_limestone');
  if (b === BLOCK.BAUXITE) return t('lb_bauxite');
  if (b === BLOCK.AG_ORE) return t('lb_ag');
  if (b === BLOCK.GOLD) return t('lb_gold');
  if (b === BLOCK.WOOD) return t('lb_wood');
  if (b === BLOCK.STONE) return t('lb_stone');
  if (b === BLOCK.GRASS || b === BLOCK.DIRT) return t('lb_dirt');
  if (b === BLOCK.PATH) return t('lb_path');
  if (b === BLOCK.BEDROCK) return t('lb_bedrock');
  return '';
}

function updateTargetHighlight() {
  var el = $('mineReticle');
  if (phase !== 'play' || uiOpen) {
    if (highlightMesh) highlightMesh.visible = false;
    if (el) el.classList.remove('show', 'ore');
    return;
  }
  ensureHighlight();
  var hit = raycastBlock(MINE_RANGE);
  if (!hit.hit || !DIGGABLE[hit.b]) {
    highlightMesh.visible = false;
    if (el) el.classList.remove('show', 'ore');
    return;
  }
  highlightMesh.visible = true;
  highlightMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  var isOre = hit.b === BLOCK.HAEMATITE || hit.b === BLOCK.COPPER_ORE ||
    hit.b === BLOCK.WOOD || hit.b === BLOCK.AG_ORE || hit.b === BLOCK.GOLD ||
    hit.b === BLOCK.BAUXITE || hit.b === BLOCK.LIMESTONE;
  highlightMesh.material.color.setHex(isOre ? 0xfbbf24 : 0xffffff);
  highlightMesh.material.opacity = isOre ? 0.28 : 0.16;
  if (el) {
    el.textContent = blockLabel(hit.b);
    el.classList.add('show');
    if (isOre) el.classList.add('ore');
    else el.classList.remove('ore');
  }
}

function discoverMetalCard(id) {
  if (discoveredCards[id]) return;
  discoveredCards[id] = true;
  var card = null, i;
  for (i = 0; i < CHEM.cards.length; i++) if (CHEM.cards[i].id === id) card = CHEM.cards[i];
  if (card) toast(t('tl_cardGot', { m: card.el + ' ' + L(card.name) }), 3000);
  /* light the monument badge */
  var mon = stationModels.monument;
  if (mon) {
    var badge = mon.getObjectByName('badge_' + id);
    if (badge && badge.material) badge.material.emissiveIntensity = 0.75;
  }
  SND.correct();
}

function mineBlock() {
  if (uiOpen || phase !== 'play') return;
  var now = performance.now();
  if (now - lastMine < MINE_COOLDOWN) return;
  var hit = raycastBlock(MINE_RANGE);
  if (!hit.hit) return;
  if (hit.b === BLOCK.BEDROCK) {
    if (now - lastMine > 500) toast(t('bedrockMsg'));
    lastMine = now;
    return;
  }
  if (!DIGGABLE[hit.b]) return;
  lastMine = now;

  var col = 0x94a3b8, gotSomething = true;
  if (hit.b === BLOCK.HAEMATITE) {
    inv.haematite++; mission.minedHaematite = true;
    toast(t('t_haematite')); col = 0xb91c1c;
  } else if (hit.b === BLOCK.COPPER_ORE) {
    inv.cuOre++; toast(t('t_copper')); col = 0x22c55e;
  } else if (hit.b === BLOCK.LIMESTONE) {
    inv.limestone++; mission.minedLimestone = true;
    toast(t('t_limestone')); col = 0xd6d3c4;
  } else if (hit.b === BLOCK.BAUXITE) {
    inv.alOre++; toast(t('t_bauxite')); col = 0xc2703d;
  } else if (hit.b === BLOCK.AG_ORE) {
    inv.agOre++; toast(t('t_ag'), 2800); col = 0x6b7280;
  } else if (hit.b === BLOCK.GOLD) {
    inv.gold++; discoverMetalCard('gold');
    toast(t('t_gold'), 2800); col = 0xffd700;
  } else if (hit.b === BLOCK.WOOD) {
    inv.wood++; mission.gotWood = true;
    toast(t('t_wood')); col = 0x6d4c33;
  } else {
    gotSomething = false;
  }

  if (hit.b === BLOCK.WOOD) SND.chop();
  else SND.mineRock();

  spawnMineBurst(hit.x, hit.y, hit.z, col);
  setB(hit.x, hit.y, hit.z, BLOCK.AIR);
  rebuildMesh();
  if (gotSomething) {
    updateHud();
    updateMissionPad();
  }
}

function nearStation() {
  var k, s, sx, sz, dx, dz;
  for (k in STATIONS) {
    if (!STATIONS.hasOwnProperty(k)) continue;
    s = STATIONS[k];
    sx = s.x + 0.5; sz = s.z + 0.5;
    dx = player.x - sx; dz = player.z - sz;
    if (dx * dx + dz * dz < s.r * s.r && player.y >= 3 && player.y < 9) return k;
  }
  return null;
}

function updatePrompt() {
  var el = $('prompt');
  if (phase !== 'play' || uiOpen) { el.classList.remove('show'); return; }
  var s = nearStation();
  if (!s) { el.classList.remove('show'); return; }
  el.textContent = t(STATIONS[s].labelKey);
  el.classList.add('show');
}

function getWeapon() {
  if (hotbarIdx < 0 || hotbarIdx > 5) return null;
  return weapons[hotbarIdx] || null;
}

function equipWeaponSlot(n) {
  if (n < 0 || n > 5 || !weapons[n]) return;
  hotbarIdx = n;
  if (aimZoom && weapons[n].type !== 'bow') setAimZoom(false);
  renderHotbar();
  updateHud();
  toast(t('weaponEquipped', { w: L(weapons[n].name) }));
}

/* --- mission objectives + beacon --- */
var lastObjectiveKey = '';
function currentObjective() {
  if (!mission.gotWood) return { key: 'wood', text: t('obj_wood'), station: null };
  if (!mission.madeCarbon) return { key: 'kiln', text: t('obj_kiln'), station: 'kiln' };
  if (!mission.minedHaematite || !mission.minedLimestone) {
    return { key: 'ores', text: t('obj_ores'), station: null };
  }
  if (!mission.extractedIron) return { key: 'furnace', text: t('obj_furnace'), station: 'furnace' };
  if (!mission.extractedCopper) {
    if (inv.cuOre < 1 && !mission.extractedCopper) {
      return { key: 'cuMine', text: t('obj_copper') + ' · ' + t('lb_copper'), station: null };
    }
    return { key: 'copper', text: t('obj_copper'), station: 'copper' };
  }
  if (!mission.madePower) {
    if (inv.carbon < 1) return { key: 'powerWood', text: t('obj_power') + ' · ' + t('obj_kiln'), station: 'kiln' };
    return { key: 'power', text: t('obj_power'), station: 'generator' };
  }
  if (!mission.extractedAluminium) {
    if (inv.alOre < 1) return { key: 'bauxite', text: t('obj_bauxite'), station: null };
    return { key: 'cell', text: t('obj_cell'), station: 'cell' };
  }
  if (!mission.craftedWeapon) return { key: 'weapon', text: t('obj_weapon'), station: 'craft' };
  if (!mission.craftedArmour) return { key: 'armourOpt', text: t('obj_armourOpt'), station: 'boss' };
  return { key: 'bossReady', text: t('obj_bossReady'), station: 'boss' };
}

function updateHud() {
  renderItemBar();
  var obj = $('objective');
  if (phase === 'boss') {
    obj.textContent = (aimZoom ? '🏹 ' : '') + t('obj_boss');
  } else {
    var o = currentObjective();
    obj.textContent = o.text;
    if (o.key !== lastObjectiveKey) {
      lastObjectiveKey = o.key;
      setBeacon(o.station);
    }
  }
  renderHotbar();
  refreshHeldWeapon();
  var w = getWeapon();
  var eq = w ? (w.icon + ' ' + L(w.name) + ' · ' + w.dmg) : t('noWeapon');
  if (hasArmour) eq += ' · ' + t('armourLabel');
  $('equippedLabel').textContent = eq;
  var arm = playerRig && playerRig.getObjectByName('armourMesh');
  if (arm) arm.visible = !!hasArmour;
}

var ITEM_DEFS = [
  { key: 'wood', icon: '🪵', label: { en: 'Wood', zh: '木材' } },
  { key: 'carbon', icon: '⬛', label: { en: 'Carbon', zh: '碳' } },
  { key: 'haematite', icon: '🟥', label: { en: 'Haematite', zh: '赤鐵礦' } },
  { key: 'limestone', icon: '🪨', label: { en: 'Limestone', zh: '石灰石' } },
  { key: 'cuOre', icon: '🟩', label: { en: 'Cu ore', zh: '銅礦' } },
  { key: 'alOre', icon: '🟫', label: { en: 'Bauxite', zh: '鋁土礦' } },
  { key: 'agOre', icon: '🩶', label: { en: 'Ag₂O', zh: 'Ag₂O' } },
  { key: 'gold', icon: '🟡', label: { en: 'Gold', zh: '金' } },
  { key: 'fe', icon: '⚙️', label: { en: 'Iron', zh: '鐵' } },
  { key: 'cu', icon: '🔶', label: { en: 'Copper', zh: '銅' } },
  { key: 'al', icon: '🔩', label: { en: 'Al', zh: '鋁' } },
  { key: 'silver', icon: '⚪', label: { en: 'Ag', zh: '銀' } },
  { key: 'electricity', icon: '⚡', label: { en: '⚡', zh: '⚡' } }
];
function renderItemBar() {
  var bar = $('itemBar');
  if (!bar) return;
  bar.innerHTML = '';
  ITEM_DEFS.forEach(function (it) {
    var n = inv[it.key] || 0;
    var d = document.createElement('div');
    d.className = 'item-slot' + (n > 0 ? ' has' : ' empty');
    d.title = L(it.label) + ': ' + n;
    d.innerHTML = '<span class="ico">' + it.icon + '</span>' +
      '<span class="lbl">' + L(it.label) + '</span>' +
      '<span class="cnt">' + n + '</span>';
    bar.appendChild(d);
  });
}

function renderHotbar() {
  var hb = $('hotbar');
  if (!hb) return;
  hb.innerHTML = '';
  var i, w, d;
  for (i = 0; i < 6; i++) {
    w = weapons[i];
    d = document.createElement('div');
    d.className = 'slot' + (i === hotbarIdx ? ' active' : '') + (w ? '' : ' empty');
    d.innerHTML =
      (w ? '<span class="ico">' + w.icon + '</span>' : '') +
      '<span class="n">' + (i + 1) + '</span>' +
      (w ? '<span class="cnt">' + w.dmg + '</span>' : '');
    d.title = w ? (L(w.name) + ' · ' + w.dmg) : '';
    (function (slot, weapon) {
      d.addEventListener('click', function (e) {
        e.stopPropagation();
        if (weapon) equipWeaponSlot(slot);
      });
    })(i, w);
    hb.appendChild(d);
  }
}

function updateMissionPad() {
  var list = $('missionList');
  if (!list) return;
  var items = [
    { ok: mission.gotWood, text: t('missionWood') },
    { ok: mission.madeCarbon, text: t('missionCarbon') },
    { ok: mission.minedHaematite && mission.minedLimestone, text: t('missionOres') },
    { ok: mission.extractedIron, text: t('missionIron') },
    { ok: mission.extractedCopper, text: t('missionCopper') },
    { ok: mission.madePower, text: t('missionPower') },
    { ok: mission.extractedAluminium, text: t('missionAl') },
    { ok: mission.craftedWeapon, text: t('missionWeapon') },
    { ok: mission.craftedArmour, text: t('missionArmour') },
    { ok: mission.timelineSolved, text: t('missionTL'), opt: true },
    { ok: mission.extractedSilver, text: t('missionSilver'), opt: true },
    { ok: mission.defeatedBoss, text: t('missionBoss') }
  ];
  list.innerHTML = '';
  items.forEach(function (it) {
    var li = document.createElement('li');
    li.className = it.ok ? 'done' : (it.opt ? 'opt todo' : 'todo');
    li.textContent = (it.ok ? '☑ ' : '☐ ') + it.text;
    list.appendChild(li);
  });
}

/* --- toast / timer / vignette --- */
function toast(msg, ms) {
  var el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove('show'); }, ms || 1800);
}
function hurtFlash() {
  var v = $('vignette');
  v.classList.add('hurt');
  setTimeout(function () { v.classList.remove('hurt'); }, 380);
}
function formatRunTime(totalSec) {
  totalSec = Math.max(0, Math.floor(totalSec));
  var m = Math.floor(totalSec / 60);
  var s = totalSec % 60;
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}
function getRunElapsedSec() {
  if (!runStartMs) return runPenaltySec;
  return (performance.now() - runStartMs) / 1000 + runPenaltySec;
}
function updateRunTimerDisplay() {
  var el = $('gameTimerVal');
  var pen = $('gameTimerPen');
  if (!el) return;
  el.textContent = formatRunTime(getRunElapsedSec());
  if (pen) pen.textContent = runPenaltySec > 0 ? ('+' + runPenaltySec + 's') : '';
}
function addTimePenalty(sec, reasonKey) {
  runPenaltySec += sec;
  updateRunTimerDisplay();
  toast(t('wrongPen', { r: reasonKey || '' }), 1800);
}
function startRunTimer() {
  runTimerActive = true;
  runStartMs = performance.now();
  runPenaltySec = 0;
  $('gameTimer').classList.add('show');
  updateRunTimerDisplay();
  if (runTimerInterval) clearInterval(runTimerInterval);
  runTimerInterval = setInterval(function () {
    if (runTimerActive) updateRunTimerDisplay();
  }, 250);
}
function stopRunTimer() {
  runTimerActive = false;
  if (runTimerInterval) { clearInterval(runTimerInterval); runTimerInterval = null; }
}

/* --- screens --- */
function showScreen(id) {
  var els = document.querySelectorAll('.overlay');
  var i;
  for (i = 0; i < els.length; i++) els[i].classList.add('hidden');
  if (id) {
    $(id).classList.remove('hidden');
    uiOpen = true;
    exitPointer();
    mineHeld = false;
    touchStick.x = 0; touchStick.y = 0; touchStick.active = false;
    if (touchMode) setTouchUIVisible(false);
  } else {
    uiOpen = false;
    if (touchMode && (phase === 'play' || phase === 'boss')) setTouchUIVisible(true);
  }
}
function exitPointer() { if (document.pointerLockElement) document.exitPointerLock(); }
function isTouchDevice() {
  return ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
}
function canControlGame() {
  return !uiOpen && (phase === 'play' || phase === 'boss') && (pointerLocked || touchMode || dragLookMode);
}
function requestPointer() {
  if (touchMode) return;
  if (uiOpen || phase === 'menu' || phase === 'win') return;
  var c = renderer.domElement;
  if (!c.requestPointerLock) { dragLookMode = true; return; }
  if (document.pointerLockElement !== c) {
    try {
      var p = c.requestPointerLock();
      if (p && p.catch) p.catch(function () { dragLookMode = true; });
    } catch (e) { dragLookMode = true; }
  }
  /* If pointer lock silently fails (common in hub iframes), fall back to drag-look */
  setTimeout(function () {
    if (!pointerLocked && !touchMode && (phase === 'play' || phase === 'boss')) dragLookMode = true;
  }, 900);
}
function setTouchUIVisible(on) {
  var el = $('touchUI');
  if (!el) return;
  if (on) el.classList.add('show');
  else el.classList.remove('show');
}

function tryInteractStation() {
  if (phase !== 'play' || uiOpen) return;
  var s = nearStation();
  if (s === 'kiln') openExtract('kiln');
  else if (s === 'furnace') openExtract('furnace_iron');
  else if (s === 'copper') openCopperMenu();
  else if (s === 'generator') openExtract('generator_power');
  else if (s === 'cell') openCell();
  else if (s === 'craft') openCraft();
  else if (s === 'monument') openTimeline();
  else if (s === 'boss') openGate();
  else toast('Walk into a station ring, then Use');
}

/* ============================================================
 * 11. Extraction UI (predict → heat → explain)
 * ============================================================ */
function isMastered(recId) { return !!processMastery[recId]; }

function openExtract(kind) {
  var rec = RECIPES_EX[kind];
  if (!rec) return;
  if (heating) return;
  extractActive = kind;
  reactorSlots = rec.slots.map(function () { return null; });
  heatT = 0;
  heatMode = 'success';
  predictChoice = -1;
  pendingExplain = false;
  pendingBonus = null;
  $('exHeatFill').style.width = '0%';
  $('exReactor').classList.remove('heating', 'failing');
  $('exTitle').textContent = L(rec.title);
  $('exIntro').textContent = L(rec.intro) +
    (rec.needInv && rec.needInv.electricity ? '  ⚡ ' + inv.electricity : '');
  $('exFormula').textContent = L(rec.formula);
  $('exHint').textContent = isMastered(kind) ? t('masteredNote') : t('firstNote');
  $('exMsg').innerHTML = '';
  $('exHeatLabel').textContent = t('readyHeat');
  $('btnHeat').disabled = false;
  $('exPredict').classList.add('hidden');
  $('exExplain').classList.add('hidden');

  /* zone strip for the blast furnace */
  var zs = $('exZoneStrip');
  if (rec.zones) {
    zs.innerHTML = '';
    CHEM.zones.forEach(function (z) {
      var row = document.createElement('div');
      row.className = 'zone-row';
      row.innerHTML = '<span class="z-ico">' + z.ico + '</span><span><b>' +
        L(z.where) + '</b><br><span style="font-family:\'Share Tech Mono\',monospace">' + z.eq +
        '</span> · ' + L(z.note) + '</span>';
      zs.appendChild(row);
    });
    zs.classList.remove('hidden');
  } else {
    zs.classList.add('hidden');
    zs.innerHTML = '';
  }

  refreshExtractUI();
  showScreen('screenExtract');
}

function openCopperMenu() {
  if (heating) return;
  extractActive = null;
  showScreen('screenExtract');
  $('exTitle').textContent = lang === 'en' ? 'Copper Works / Silver oxide' : '煉銅工場／氧化銀';
  $('exIntro').textContent = lang === 'en'
    ? 'Choose a process: extract copper with carbon, OR heat silver oxide to get silver metal (no carbon).'
    : '選擇流程：用碳提取銅，或加熱氧化銀得銀（不需碳）。';
  $('exFormula').textContent = 'Cu: ' + CHEM.eq.copper + '   |   Ag: ' + CHEM.eq.silver;
  $('exHint').textContent = t('copperInfo');
  $('exHeatLabel').textContent = t('chooseCopper');
  $('exHeatFill').style.width = '0%';
  $('exReactor').innerHTML = '';
  $('exPredict').classList.add('hidden');
  $('exExplain').classList.add('hidden');
  $('exZoneStrip').classList.add('hidden');
  $('btnHeat').disabled = true;
  var bag = $('exBag');
  bag.innerHTML = '';
  function addMode(id, label, desc) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'bag-btn';
    b.style.minWidth = '100%';
    b.style.textAlign = 'left';
    b.innerHTML = '<b>' + label + '</b><br><small style="color:#94a3b8">' + desc + '</small>';
    b.addEventListener('click', function () { openExtract(id); });
    bag.appendChild(b);
  }
  addMode('copper', lang === 'en' ? '① Copper extraction' : '① 提取銅',
    lang === 'en' ? '2CuO + C → 2Cu + CO₂ (needs carbon)' : '2CuO + C → 2Cu + CO₂（需要碳）');
  addMode('silver_roast', lang === 'en' ? '② Silver oxide heat' : '② 加熱氧化銀',
    lang === 'en' ? '2Ag₂O → 4Ag + O₂ (heat only — no carbon)' : '2Ag₂O → 4Ag + O₂（只需加熱）');
  $('exMsg').innerHTML = '<div class="msg info">' + t('copperInfo') + '</div>';
}

function openCell() {
  if ((inv.electricity || 0) < 1) {
    toast(t('needPowerFirst'), 2600);
    return;
  }
  openExtract('al_cell');
}

function countInReactor(key) {
  var n = 0, i;
  for (i = 0; i < reactorSlots.length; i++) if (reactorSlots[i] === key) n++;
  return n;
}
function freeBagCount(key) { return (inv[key] || 0) - countInReactor(key); }
function reactorHasAny() {
  var i;
  for (i = 0; i < reactorSlots.length; i++) if (reactorSlots[i]) return true;
  return false;
}
function renderPickOpts(containerId, opts, selected, onPick) {
  var box = $(containerId);
  box.innerHTML = '';
  opts.forEach(function (o, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick-opt' + (selected === i ? ' sel' : '');
    b.textContent = o;
    b.addEventListener('click', function () { onPick(i); });
    box.appendChild(b);
  });
}
function updatePredictPanel() {
  var rec = RECIPES_EX[extractActive];
  var panel = $('exPredict');
  if (!rec || isMastered(rec.id) || !reactorMatchesNeed(rec) || heating || pendingExplain || pendingBonus) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  $('exPredictQ').textContent = L(rec.predictQ);
  renderPickOpts('exPredictOpts', L(rec.predictOpts), predictChoice, function (i) {
    predictChoice = i;
    updatePredictPanel();
    $('exMsg').innerHTML = i === rec.predictA
      ? '<div class="msg ok">' + t('predGood') + '</div>'
      : '<div class="msg info">' + t('predSaved') + '</div>';
  });
}
function reactorMatchesNeed(rec) {
  var need = rec.need, k, have, i;
  for (k in need) {
    if (!need.hasOwnProperty(k)) continue;
    have = countInReactor(k);
    if (have < need[k]) return false;
  }
  for (i = 0; i < reactorSlots.length; i++) {
    if (reactorSlots[i] && !need[reactorSlots[i]]) return false;
  }
  for (i = 0; i < reactorSlots.length; i++) {
    if (!reactorSlots[i]) return false;
  }
  if (rec.needInv) {
    for (k in rec.needInv) {
      if ((inv[k] || 0) < rec.needInv[k]) return false;
    }
  }
  return true;
}
function refreshExtractUI() {
  var rec = RECIPES_EX[extractActive];
  if (!rec) return;
  var bag = $('exBag');
  var reactor = $('exReactor');
  var locked = heating || pendingExplain || pendingBonus;
  bag.innerHTML = '';
  ITEM_DEFS.forEach(function (it) {
    var free = freeBagCount(it.key);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'bag-btn';
    b.disabled = locked || free < 1;
    b.textContent = it.icon + ' ' + L(it.label) + ' ×' + free;
    b.addEventListener('click', function () { addToReactor(it.key); });
    bag.appendChild(b);
  });

  reactor.innerHTML = '';
  rec.slots.forEach(function (slotDef, idxS) {
    if (idxS > 0) {
      var plus = document.createElement('div');
      plus.className = 'plus-sign';
      plus.textContent = '+';
      reactor.appendChild(plus);
    }
    var slot = document.createElement('div');
    var filled = reactorSlots[idxS];
    slot.className = 'put-slot' + (filled ? ' filled' : '');
    if (filled) {
      var icon = '', lbl = '';
      ITEM_DEFS.forEach(function (it) { if (it.key === filled) { icon = it.icon; lbl = L(it.label); } });
      slot.innerHTML = '<span class="x">✕</span><span class="big">' + icon + '</span><span class="sm">' + lbl + '</span>';
      slot.addEventListener('click', function () {
        if (locked) return;
        reactorSlots[idxS] = null;
        predictChoice = -1;
        refreshExtractUI();
      });
    } else {
      slot.innerHTML = '<span class="big">+</span><span class="sm">' + slotDef.icon + ' ' + L(slotDef.label) + '</span>';
    }
    reactor.appendChild(slot);
  });
  var arr = document.createElement('div');
  arr.className = 'arrow-sign';
  arr.textContent = '→';
  reactor.appendChild(arr);
  var out = document.createElement('div');
  out.className = 'put-slot';
  out.style.borderStyle = 'dashed';
  out.innerHTML = '<span class="big">✨</span><span class="sm">' + L(rec.outputLabel) + '</span>';
  reactor.appendChild(out);
  updatePredictPanel();
}
function addToReactor(key) {
  if (heating || pendingExplain || !extractActive) return;
  var rec = RECIPES_EX[extractActive];
  if (freeBagCount(key) < 1) {
    var lbl = key;
    ITEM_DEFS.forEach(function (it) { if (it.key === key) lbl = L(it.label); });
    toast(t('notEnough', { m: lbl }));
    return;
  }
  var i, placed = false;
  for (i = 0; i < rec.slots.length; i++) {
    if (!reactorSlots[i] && rec.slots[i].key === key) { reactorSlots[i] = key; placed = true; break; }
  }
  if (!placed) {
    for (i = 0; i < reactorSlots.length; i++) {
      if (!reactorSlots[i]) { reactorSlots[i] = key; placed = true; break; }
    }
  }
  if (!placed) toast(t('reactorFull'));
  else { SND.place(); predictChoice = -1; }
  refreshExtractUI();
}
function clearReactor() {
  if (heating || pendingExplain || pendingBonus) return;
  reactorSlots = (RECIPES_EX[extractActive] ? RECIPES_EX[extractActive].slots : []).map(function () { return null; });
  predictChoice = -1;
  $('exMsg').innerHTML = '';
  $('exHeatLabel').textContent = t('readyHeat');
  $('exHeatFill').style.width = '0%';
  $('exPredict').classList.add('hidden');
  $('exExplain').classList.add('hidden');
  refreshExtractUI();
}

/* Productive-failure science feedback (SOW chemistry) */
function diagnoseWrongReactor(rec) {
  var has = function (k) { return countInReactor(k) > 0; };
  if (!reactorHasAny()) {
    return lang === 'en'
      ? 'Reactor is empty. Put the materials from the formula into the slots first.'
      : '反應器是空的。先把化學式中的材料放入槽中。';
  }
  if (rec.id === 'kiln') {
    if (has('haematite') || has('cuOre') || has('alOre') || has('limestone')) {
      return lang === 'en' ? 'Ore/limestone does not belong in the kiln. Burn <b>wood</b> here to make carbon.'
        : '礦石／石灰石不屬於炭窯。在這裏燒<b>木材</b>製碳。';
    }
    return lang === 'en' ? 'The kiln needs <b>wood only</b>.' : '炭窯只需要<b>木材</b>。';
  }
  if (rec.id === 'furnace_iron') {
    if (has('limestone') && has('haematite') && !has('carbon')) {
      return lang === 'en' ? 'Add <b>coke (carbon)</b> — it burns for heat and makes the CO that reduces the ore.'
        : '加入<b>焦炭（碳）</b>——它燃燒供熱，並製造還原礦石的CO。';
    }
    if (has('haematite') && has('carbon') && !has('limestone')) {
      return lang === 'en' ? 'Add <b>limestone</b> — it removes sandy impurities as slag (CaO + SiO₂ → CaSiO₃).'
        : '加入<b>石灰石</b>——它除去泥沙雜質成爐渣（CaO + SiO₂ → CaSiO₃）。';
    }
    if (has('carbon') && !has('haematite') && !has('limestone')) {
      return lang === 'en' ? 'Carbon alone belongs in the <b>Power Generator</b> (makes ⚡), or add haematite + limestone for iron.'
        : '只有碳的話請到<b>發電機</b>（產生⚡），或加入赤鐵礦＋石灰石煉鐵。';
    }
    if (has('cuOre')) return lang === 'en' ? 'Copper ore goes to the <b>Copper Works</b>.' : '銅礦應到<b>煉銅工場</b>。';
    if (has('alOre')) return lang === 'en' ? 'Bauxite needs the <b>Electrolysis Cell</b> (⚡), not the furnace.'
      : '鋁土礦需要<b>電解池</b>（⚡），不是高爐。';
    if (has('limestone') && !has('haematite')) {
      return lang === 'en' ? 'Add <b>haematite</b> (red-brown ore from the west hills).'
        : '加入<b>赤鐵礦</b>（西面山丘的紅棕色礦石）。';
    }
    return lang === 'en' ? 'Charge = <b>haematite + coke + limestone</b>.'
      : '爐料＝<b>赤鐵礦＋焦炭＋石灰石</b>。';
  }
  if (rec.id === 'generator_power') {
    if (has('haematite') || has('cuOre') || has('alOre') || has('limestone')) {
      return lang === 'en' ? 'The generator burns <b>carbon only</b>. Ores belong at the furnace / works / cell.'
        : '發電機只燒<b>碳</b>。礦石屬於高爐／工場／電解池。';
    }
    return lang === 'en' ? 'Put <b>carbon</b> alone to make ⚡ electricity.' : '放入<b>碳</b>產生⚡電力。';
  }
  if (rec.id === 'al_cell') {
    if ((inv.electricity || 0) < 1) return t('needPowerFirst');
    if (!has('alOre')) return lang === 'en' ? 'Put <b>bauxite</b> (reddish ore from the east edges) in the reactor.'
      : '把<b>鋁土礦</b>（東面邊緣的紅棕色礦石）放入反應器。';
    if (has('haematite') || has('cuOre')) return lang === 'en' ? 'This cell is for <b>bauxite only</b>.'
      : '此電解池只處理<b>鋁土礦</b>。';
    return lang === 'en' ? 'Need bauxite in the reactor + ⚡ in your bag.' : '反應器需要鋁土礦＋背包需要⚡。';
  }
  if (rec.id === 'copper') {
    if (has('cuOre') && !has('carbon')) return lang === 'en' ? 'Add <b>carbon</b> so copper can be freed.'
      : '加入<b>碳</b>才能釋放出銅。';
    if (has('carbon') && !has('cuOre')) return lang === 'en' ? 'Add <b>copper ore</b> (green spots, east quarry).'
      : '加入<b>銅礦</b>（東面採石場的綠色斑點）。';
    if (has('agOre')) return lang === 'en' ? 'Silver oxide uses process ② (heat only). Not copper + carbon.'
      : '氧化銀用流程②（只需加熱），不是銅＋碳。';
    if (has('haematite')) return lang === 'en' ? 'Haematite → Blast Furnace. Here: copper ore + carbon.'
      : '赤鐵礦→高爐。這裏：銅礦＋碳。';
    return lang === 'en' ? 'Need <b>copper ore + carbon</b>.' : '需要<b>銅礦＋碳</b>。';
  }
  if (rec.id === 'silver_roast') {
    if (has('carbon')) return lang === 'en' ? 'Silver oxide decomposes on <b>heat alone</b> — no carbon. Put only Ag₂O.'
      : '氧化銀<b>單靠加熱</b>便分解——不需碳。只放Ag₂O。';
    if (!has('agOre')) return lang === 'en' ? 'Put <b>silver oxide ore (Ag₂O)</b> — rare grey-red blocks in the map corners.'
      : '放入<b>氧化銀礦（Ag₂O）</b>——地圖角落的稀有灰紅色方塊。';
    return lang === 'en' ? 'Need <b>silver oxide</b> only: silver oxide → silver + oxygen.'
      : '只需要<b>氧化銀</b>：氧化銀→銀＋氧氣。';
  }
  return lang === 'en' ? 'Check the formula strip and put the correct blocks.' : '看看化學式欄，放入正確的方塊。';
}

function startHeating() {
  if (heating || pendingExplain || pendingBonus || !extractActive) return;
  var rec = RECIPES_EX[extractActive];
  var k;

  if (!reactorHasAny()) {
    $('exMsg').innerHTML = '<div class="msg err">' + diagnoseWrongReactor(rec) + '</div>';
    SND.wrong();
    return;
  }

  if (!reactorMatchesNeed(rec)) {
    heating = true;
    heatMode = 'fail';
    heatT = 0;
    heatMs = 1400;
    mission.failedHeats++;
    $('exReactor').classList.remove('heating');
    $('exReactor').classList.add('failing');
    $('exHeatLabel').textContent = t('heatingWrong');
    $('exMsg').innerHTML = '<div class="msg info">' + t('tryingHeat') + '</div>';
    $('btnHeat').disabled = true;
    $('exPredict').classList.add('hidden');
    SND.burn();
    refreshExtractUI();
    return;
  }

  if (!isMastered(rec.id) && predictChoice < 0) {
    updatePredictPanel();
    $('exMsg').innerHTML = '<div class="msg info">' + t('predictionRequired') + '</div>';
    SND.place();
    return;
  }

  for (k in rec.need) {
    if ((inv[k] || 0) < rec.need[k]) {
      $('exMsg').innerHTML = '<div class="msg err">' + t('matsNotEnough') + '</div>';
      return;
    }
  }
  if (rec.needInv) {
    for (k in rec.needInv) {
      if ((inv[k] || 0) < rec.needInv[k]) {
        $('exMsg').innerHTML = '<div class="msg err">' + t('needMore', { m: '⚡' }) + '</div>';
        return;
      }
    }
  }

  heating = true;
  heatMode = 'success';
  heatT = 0;
  heatMs = rec.heatMs;
  $('exReactor').classList.remove('failing');
  $('exReactor').classList.add('heating');
  $('exHeatLabel').textContent = L(rec.captions)[0] || '…';
  var predNote = isMastered(rec.id) ? t('predMastered')
    : (predictChoice === rec.predictA ? t('predMatch') : t('predWatch'));
  $('exMsg').innerHTML = '<div class="msg info">' + t('heatingOk', { p: predNote }) + '</div>';
  $('btnHeat').disabled = true;
  $('exPredict').classList.add('hidden');
  SND.burn();
  refreshExtractUI();
}

function finishFailHeat() {
  var rec = RECIPES_EX[extractActive];
  heating = false;
  heatT = 0;
  $('exReactor').classList.remove('failing', 'heating');
  $('exHeatFill').style.width = '0%';
  $('exHeatLabel').textContent = lang === 'en' ? 'Process failed — fix materials and try again' : '過程失敗——修正材料再試';
  $('exMsg').innerHTML = '<div class="msg err"><b>' + t('whyFailed') + '</b> ' + diagnoseWrongReactor(rec) +
    '<br><span style="color:#94a3b8">' + t('matsKept') + '</span></div>';
  $('btnHeat').disabled = false;
  SND.wrong();
  refreshExtractUI();
  updateMissionPad();
}

function applyProcessOutputs(rec) {
  var k;
  for (k in rec.need) {
    if (rec.need.hasOwnProperty(k)) inv[k] -= rec.need[k];
  }
  if (rec.needInv) {
    for (k in rec.needInv) {
      if (rec.needInv.hasOwnProperty(k)) inv[k] -= rec.needInv[k];
    }
  }
  for (k in rec.output) {
    if (rec.output.hasOwnProperty(k)) inv[k] = (inv[k] || 0) + rec.output[k];
  }
  if (rec.id === 'furnace_iron') {
    furnacePourT = 2.2;
    var fs = STATIONS.furnace;
    spawnGlowBurst(fs.x + 2.6, 4.6, fs.z + 1.8, 0xff7b2d, 12);
    discoverMetalCard('iron');
  }
  if (rec.id === 'copper') discoverMetalCard('copper');
  if (rec.id === 'silver_roast') discoverMetalCard('silver');
  if (rec.id === 'al_cell') discoverMetalCard('aluminium');
  if (rec.id === 'generator_power' || rec.id === 'al_cell') SND.zap();
}

function showExplainPanel(rec) {
  pendingExplain = true;
  $('exExplain').classList.remove('hidden');
  $('exExplainQ').textContent = L(rec.explainQ);
  renderPickOpts('exExplainOpts', L(rec.explainOpts), -1, function (i) {
    if (i === rec.explainA) {
      SND.correct();
      $('exMsg').innerHTML = '<div class="msg ok">' + t('explainOk') + '</div>';
      if (rec.missionFlag) mission[rec.missionFlag] = true;
      processMastery[rec.id] = true;
      pendingExplain = false;
      $('exExplain').classList.add('hidden');
      $('btnHeat').disabled = false;
      predictChoice = -1;
      updateHud();
      updateMissionPad();
      refreshExtractUI();
    } else {
      SND.wrong();
      addTimePenalty(10, lang === 'en' ? 'Wrong explanation' : '解釋錯誤');
      wrongLog.push({ q: L(rec.explainQ), chose: L(rec.explainOpts)[i], ans: L(rec.explainOpts)[rec.explainA] });
      $('exMsg').innerHTML = '<div class="msg err">' + t('explainErr') + '</div>';
    }
  });
}

function showBonusQuestion(rec) {
  if (!rec.bonusQs || !rec.bonusQs.length) {
    $('btnHeat').disabled = false;
    return;
  }
  var pool = rec.bonusQs;
  var q = pool[Math.floor(Math.random() * pool.length)];
  pendingBonus = { recId: rec.id, q: q };
  $('exExplain').classList.remove('hidden');
  $('exExplainQ').textContent = (lang === 'en' ? 'Bonus (repeat heat): ' : '獎勵題（重複加熱）：') + L(q.q);
  renderPickOpts('exExplainOpts', L(q.opts), -1, function (i) {
    if (i === q.a) {
      SND.correct();
      inv.electricity = (inv.electricity || 0) + 1;
      $('exMsg').innerHTML = '<div class="msg ok">' + t('bonusRight') + '</div>';
    } else {
      SND.wrong();
      addTimePenalty(10, lang === 'en' ? 'Wrong bonus answer' : '獎勵題答錯');
      wrongLog.push({ q: L(q.q), chose: L(q.opts)[i], ans: L(q.opts)[q.a] });
      $('exMsg').innerHTML = '<div class="msg info">' + t('bonusMiss') + '</div>';
    }
    pendingBonus = null;
    $('exExplain').classList.add('hidden');
    $('btnHeat').disabled = false;
    updateHud();
    refreshExtractUI();
  });
}

function finishSuccessHeat() {
  var rec = RECIPES_EX[extractActive];
  if (!rec) { heating = false; return; }
  applyProcessOutputs(rec);
  SND.smeltDone();
  reactorSlots = rec.slots.map(function () { return null; });
  heating = false;
  heatT = 0;
  processSuccessCount[rec.id] = (processSuccessCount[rec.id] || 0) + 1;
  $('exReactor').classList.remove('heating', 'failing');
  $('exHeatFill').style.width = '100%';
  $('exHeatLabel').textContent = t('doneGot', { o: L(rec.outputLabel) }) + (rec.slag ? t('slagToo') : '');

  if (!isMastered(rec.id)) {
    var predLine = predictChoice === rec.predictA ? ' ✓' : '';
    $('exMsg').innerHTML = '<div class="msg ok">✅ <b>' + L(rec.formula).split('\n').pop() + '</b> → ' +
      L(rec.outputLabel) + '!' + predLine + '<br>' +
      (lang === 'en' ? 'Now explain (once only for this process).' : '現在解釋（此流程只需一次）。') + '</div>';
    showExplainPanel(rec);
  } else {
    if (rec.missionFlag) mission[rec.missionFlag] = true;
    $('exMsg').innerHTML = '<div class="msg ok">✅ ' +
      (lang === 'en' ? 'Got ' : '獲得') + L(rec.outputLabel) +
      (lang === 'en' ? ' (process already mastered).' : '（此流程已熟練）。') + '</div>';
    if (processSuccessCount[rec.id] >= 2 && rec.bonusQs && rec.bonusQs.length) {
      showBonusQuestion(rec);
    } else {
      $('btnHeat').disabled = false;
    }
  }
  updateHud();
  updateMissionPad();
  refreshExtractUI();
  setTimeout(function () {
    if (!heating) $('exHeatFill').style.width = '0%';
  }, 900);
}

function finishHeating() {
  if (heatMode === 'fail') finishFailHeat();
  else finishSuccessHeat();
}

function updateHeating() {
  if (!heating) return;
  var rec = RECIPES_EX[extractActive];
  heatT += dt * 1000;
  var pct = Math.min(100, (heatT / heatMs) * 100);
  $('exHeatFill').style.width = pct + '%';
  if (heatMode === 'success' && rec) {
    var caps = L(rec.captions);
    var ci = Math.min(caps.length - 1, Math.floor((pct / 100) * caps.length));
    $('exHeatLabel').textContent = caps[ci];
    /* light furnace zone rows one by one */
    if (rec.zones) {
      var rows = $('exZoneStrip').children;
      var zi;
      for (zi = 0; zi < rows.length; zi++) {
        if (pct >= (zi + 1) * (100 / rows.length)) rows[zi].classList.add('lit');
        else rows[zi].classList.remove('lit');
      }
    }
  }
  if (Math.random() < 0.08) SND.tone(90 + Math.random() * 40, 0.04, 'sawtooth', 0.02);
  if (heatT >= heatMs) finishHeating();
}

/* ============================================================
 * 12. Reactivity ladder + discovery timeline
 * ============================================================ */
function metalObtained(key) {
  if (key === 'fe') return mission.extractedIron;
  if (key === 'cu') return mission.extractedCopper;
  if (key === 'silver') return mission.extractedSilver;
  if (key === 'al') return mission.extractedAluminium;
  if (key === 'gold') return discoveredCards.gold || inv.gold > 0;
  return false;
}
function openLadder() {
  var box = $('ladderBox');
  box.innerHTML = '';
  CHEM.ladder.forEach(function (r) {
    var row = document.createElement('div');
    row.className = 'rung' + (r.method ? ' ' + (r.method === 'electro' ? 'electro' : r.method === 'carbon' ? 'carbon' : r.method === 'heat' ? 'heat' : 'free') : '');
    if (r.carbonLine) row.className += ' carbonline';
    if (r.metal && metalObtained(r.metal)) row.className += ' met';
    var tag = '';
    if (r.method) tag = '<span class="r-tag">' + t('tag_' + r.method) + '</span>';
    row.innerHTML = '<span class="r-el">' + r.el + '</span><span class="r-m">' + L(r.full) +
      (r.carbonLine ? '<br><small style="color:#f59e0b">' + t('carbonLine') + '</small>' : '') +
      '</span>' + tag;
    box.appendChild(row);
  });
  showScreen('screenLadder');
}

var TL_ORDINALS = { en: ['1st', '2nd', '3rd', '4th', '5th'], zh: ['第1', '第2', '第3', '第4', '第5'] };
function openTimeline() {
  renderTimeline();
  showScreen('screenTimeline');
}
function renderTimeline() {
  var slots = $('tlSlots');
  var cards = $('tlCards');
  slots.innerHTML = '';
  cards.innerHTML = '';
  var i;
  for (i = 0; i < 5; i++) {
    var sl = document.createElement('div');
    var placedId = tlPlacement[i];
    sl.className = 'tl-slot' + (placedId ? ' filled' : '');
    if (placedId) {
      var pc = null;
      CHEM.cards.forEach(function (c) { if (c.id === placedId) pc = c; });
      sl.innerHTML = '<span>' + pc.ico + '<br><b>' + pc.el + '</b><br>' + L(pc.name) + '</span>';
      (function (idxP) {
        sl.addEventListener('click', function () {
          tlPlacement[idxP] = null;
          SND.click();
          renderTimeline();
        });
      })(i);
    } else {
      sl.textContent = TL_ORDINALS[lang][i];
    }
    slots.appendChild(sl);
  }
  CHEM.cards.forEach(function (c) {
    var placed = tlPlacement.indexOf(c.id) >= 0;
    var card = document.createElement('div');
    var unlocked = discoveredCards[c.id];
    card.className = 'tl-card' + (!unlocked ? ' locked' : '') + (placed ? ' locked' : '');
    if (unlocked && !placed) {
      card.innerHTML = '<div class="c-ico">' + c.ico + '</div><div class="c-el">' + c.el + '</div>' +
        '<div class="c-nm">' + L(c.name) + '</div><div class="c-hint">' + L(c.hint) + '</div>';
      card.addEventListener('click', function () {
        var j;
        for (j = 0; j < 5; j++) {
          if (!tlPlacement[j]) { tlPlacement[j] = c.id; break; }
        }
        SND.click();
        renderTimeline();
      });
    } else if (!unlocked) {
      card.innerHTML = '<div class="c-ico">❓</div><div class="c-el">?</div><div class="c-nm">' +
        (lang === 'en' ? 'Not found yet' : '尚未發現') + '</div>';
    }
    cards.appendChild(card);
  });
  if (mission.timelineSolved) {
    $('tlMsg').innerHTML = '<div class="msg ok">' + t('tl_right') + '</div>';
  }
}
function checkTimeline() {
  var i;
  for (i = 0; i < 5; i++) if (!tlPlacement[i]) {
    $('tlMsg').innerHTML = '<div class="msg info">' + t('tl_needAll') + '</div>';
    return;
  }
  var allRight = true;
  var slots = $('tlSlots').children;
  for (i = 0; i < 5; i++) {
    var card = null;
    CHEM.cards.forEach(function (c) { if (c.id === tlPlacement[i]) card = c; });
    var right = card && card.order === i;
    if (!right) allRight = false;
    if (slots[i]) {
      if (right) slots[i].classList.add('good');
      else slots[i].classList.remove('good');
    }
  }
  if (allRight) {
    mission.timelineSolved = true;
    inv.electricity += 2;
    SND.fanfare();
    $('tlMsg').innerHTML = '<div class="msg ok">' + t('tl_right') + '<br>' + t('tl_reward') + '</div>';
    updateHud();
    updateMissionPad();
  } else {
    $('tlMsg').innerHTML = '<div class="msg info">' + t('tl_wrong') + '</div>';
  }
}
function clearTimeline() {
  tlPlacement = [null, null, null, null, null];
  $('tlMsg').innerHTML = '';
  renderTimeline();
}

/* ============================================================
 * 13. Crafting
 * ============================================================ */
var RECIPES = [
  { id: 'copper_sword', name: { en: 'Copper Sword', zh: '銅劍' }, icon: '🗡️', need: { cu: 1 }, dmg: 8, type: 'sword', speed: 450, tier: 'copper' },
  { id: 'copper_knife', name: { en: 'Copper Knife', zh: '銅刀' }, icon: '🔪', need: { cu: 1 }, dmg: 4, type: 'knife', speed: 180, tier: 'copper' },
  { id: 'copper_bow', name: { en: 'Copper Bow', zh: '銅弓' }, icon: '🏹', need: { cu: 1, wood: 1 }, dmg: 6, type: 'bow', speed: 700, tier: 'copper' },
  { id: 'iron_sword', name: { en: 'Iron Sword', zh: '鐵劍' }, icon: '🗡️', need: { fe: 2 }, dmg: 15, type: 'sword', speed: 450, tier: 'iron' },
  { id: 'iron_knife', name: { en: 'Iron Knife', zh: '鐵刀' }, icon: '🔪', need: { fe: 1 }, dmg: 7, type: 'knife', speed: 180, tier: 'iron' },
  { id: 'iron_bow', name: { en: 'Iron Bow', zh: '鐵弓' }, icon: '🏹', need: { fe: 1, wood: 1 }, dmg: 12, type: 'bow', speed: 700, tier: 'iron' },
  { id: 'silver_sword', name: { en: 'Silver Sword', zh: '銀劍' }, icon: '⚔️', need: { silver: 2 }, dmg: 22, type: 'sword', speed: 400, tier: 'silver' },
  { id: 'silver_knife', name: { en: 'Silver Knife', zh: '銀刀' }, icon: '🔪', need: { silver: 1 }, dmg: 12, type: 'knife', speed: 160, tier: 'silver' },
  { id: 'silver_bow', name: { en: 'Silver Bow', zh: '銀弓' }, icon: '🏹', need: { silver: 1, wood: 1 }, dmg: 18, type: 'bow', speed: 600, tier: 'silver' },
  { id: 'gold_sword', name: { en: 'Gold Sword', zh: '金劍' }, icon: '⚔️', need: { gold: 1 }, dmg: 30, type: 'sword', speed: 380, tier: 'gold' },
  { id: 'gold_knife', name: { en: 'Gold Knife', zh: '金刀' }, icon: '🔪', need: { gold: 1 }, dmg: 16, type: 'knife', speed: 150, tier: 'gold' },
  { id: 'gold_bow', name: { en: 'Gold Bow', zh: '金弓' }, icon: '🏹', need: { gold: 1, wood: 1 }, dmg: 24, type: 'bow', speed: 550, tier: 'gold' },
  { id: 'al_armour', name: { en: 'Aluminium Armour', zh: '鋁盔甲' }, icon: '🛡️', need: { al: 2 }, dmg: 0, type: 'armour', speed: 0, tier: 'aluminium' }
];

function canCraft(r, qty) {
  qty = qty || 1;
  return inv.fe >= (r.need.fe || 0) * qty &&
    inv.cu >= (r.need.cu || 0) * qty &&
    inv.al >= (r.need.al || 0) * qty &&
    inv.wood >= (r.need.wood || 0) * qty &&
    inv.silver >= (r.need.silver || 0) * qty &&
    inv.gold >= (r.need.gold || 0) * qty;
}
function maxCraftable(r) {
  if (r.type === 'armour' && hasArmour) return 0;
  var m = Infinity;
  var keysC = ['fe', 'cu', 'al', 'wood', 'silver', 'gold'];
  var i, k, need;
  for (i = 0; i < keysC.length; i++) {
    k = keysC[i];
    need = r.need[k] || 0;
    if (need > 0) m = Math.min(m, Math.floor((inv[k] || 0) / need));
  }
  if (m === Infinity || m < 0) m = 0;
  if (r.type !== 'armour') {
    var empty = 0, s;
    for (s = 0; s < 6; s++) if (!weapons[s]) empty++;
    if (empty < 1) empty = 1;
    m = Math.min(m, Math.max(empty, 1));
    m = Math.min(m, 6);
  } else {
    m = Math.min(m, 1);
  }
  return m;
}
function doCraft(r, qty) {
  qty = Math.max(1, Math.floor(qty || 1));
  if (!canCraft(r, qty)) {
    toast(t('matsNotEnough'));
    return false;
  }
  var n;
  for (n = 0; n < qty; n++) {
    if (r.need.fe) inv.fe -= r.need.fe;
    if (r.need.cu) inv.cu -= r.need.cu;
    if (r.need.al) inv.al -= r.need.al;
    if (r.need.wood) inv.wood -= r.need.wood;
    if (r.need.silver) inv.silver -= r.need.silver;
    if (r.need.gold) inv.gold -= r.need.gold;
    if (r.type === 'armour') {
      hasArmour = true;
      mission.craftedArmour = true;
    } else {
      var slot = -1, i;
      for (i = 0; i < 6; i++) if (!weapons[i]) { slot = i; break; }
      if (slot < 0) slot = Math.min(5, n);
      weapons[slot] = {
        id: r.id, name: r.name, icon: r.icon, need: r.need,
        dmg: r.dmg, type: r.type, speed: r.speed, tier: r.tier
      };
      hotbarIdx = slot;
      mission.craftedWeapon = true;
    }
  }
  SND.clang();
  if (r.type === 'armour') {
    toast(t('armourOn'), 3000);
  } else {
    refreshHeldWeapon(true);
    toast(t('craftOk', { q: qty > 1 ? ('×' + qty + ' ') : '', w: L(r.name) }), 2000);
  }
  updateHud();
  updateMissionPad();
  refreshRecipes();
  return true;
}
function openCraft() {
  refreshRecipes();
  showScreen('screenCraft');
}
function refreshRecipes() {
  var el = $('recipes');
  el.innerHTML = '';
  RECIPES.forEach(function (r) {
    var maxQ = maxCraftable(r);
    var can = maxQ >= 1;
    var parts = [];
    if (r.need.fe) parts.push(r.need.fe + ' Fe');
    if (r.need.cu) parts.push(r.need.cu + ' Cu');
    if (r.need.al) parts.push(r.need.al + ' Al');
    if (r.need.silver) parts.push(r.need.silver + ' Ag');
    if (r.need.gold) parts.push(r.need.gold + ' Au (' + (lang === 'en' ? 'free metal' : '游離金屬') + ')');
    if (r.need.wood) parts.push(r.need.wood + (lang === 'en' ? ' wood' : ' 木材'));
    var div = document.createElement('div');
    div.className = 'recipe' + (can ? '' : ' locked');
    div.style.flexWrap = 'wrap';
    var info = document.createElement('div');
    info.style.flex = '1';
    info.style.minWidth = '180px';
    info.innerHTML =
      '<span style="font-size:1.5rem;margin-right:8px">' + r.icon + '</span>' +
      '<b>' + L(r.name) + '</b><br><small>' + parts.join(' + ') +
      (r.type === 'armour' ? (lang === 'en' ? ' → armour' : ' → 盔甲') : (' → ' + r.dmg + ' dmg')) +
      '</small>' +
      (can ? '<br><small style="color:#5eead4">' + (lang === 'en' ? 'Can craft up to ×' : '最多可造 ×') + maxQ + '</small>' : '');
    div.appendChild(info);
    if (can) {
      var controls = document.createElement('div');
      controls.style.display = 'flex';
      controls.style.alignItems = 'center';
      controls.style.gap = '6px';
      controls.style.marginTop = '6px';
      var btn1 = document.createElement('button');
      btn1.type = 'button';
      btn1.className = 'btn';
      btn1.style.padding = '0.4rem 0.7rem';
      btn1.style.fontSize = '0.85rem';
      btn1.textContent = lang === 'en' ? 'Craft ×1' : '製造 ×1';
      btn1.addEventListener('click', function (e) { e.stopPropagation(); doCraft(r, 1); });
      var btnMax = document.createElement('button');
      btnMax.type = 'button';
      btnMax.className = 'btn sec';
      btnMax.style.padding = '0.4rem 0.7rem';
      btnMax.style.fontSize = '0.8rem';
      btnMax.textContent = (lang === 'en' ? 'Max (' : '最大 (') + maxQ + ')';
      btnMax.addEventListener('click', function (e) { e.stopPropagation(); doCraft(r, maxQ); });
      controls.appendChild(btn1);
      controls.appendChild(btnMax);
      div.appendChild(controls);
    }
    el.appendChild(div);
  });
}

/* ============================================================
 * 14. Boss gate + quiz dodge + boss fight
 * ============================================================ */
function missionReadyForBoss() { return mission.craftedWeapon; }

function openGate() {
  var ready = missionReadyForBoss();
  if (ready) {
    $('gateText').textContent = (hasArmour || relaxedMode) ? t('gate_ready_armour') : t('gate_ready_noarmour');
    $('btnEnterBoss').style.display = 'inline-block';
  } else {
    $('gateText').textContent = t('gate_locked');
    $('btnEnterBoss').style.display = 'none';
  }
  showScreen('screenGate');
}

function disposeObject3D(obj) {
  if (!obj) return;
  scene.remove(obj);
  obj.traverse(function (ch) {
    if (ch.geometry) ch.geometry.dispose();
    if (ch.material) {
      if (ch.material.map) ch.material.map.dispose();
      ch.material.dispose();
    }
  });
}
function clearArrows() {
  arrows.forEach(function (a) { if (a.mesh) disposeObject3D(a.mesh); });
  arrows = [];
}

function startBoss() {
  var x, z;
  phase = 'boss';
  player.x = 20.5; player.y = 4; player.z = 28.5; player.vy = 0;
  for (x = 15; x <= 25; x++) {
    for (z = 28; z <= 37; z++) {
      clearAbove(x, z, 4);
      setB(x, 3, z, BLOCK.PATH);
    }
  }
  rebuildMesh();

  boss.hp = boss.maxHp; boss.x = 20.5; boss.z = 32.5;
  boss.hits = 0; boss.lastAttack = performance.now(); boss.anim = 0; boss.dying = 0;
  playerHp = 100; dodgeOpen = false; dodgeAnswered = false;
  clearArrows();
  clearDodgeTimer();
  setBeacon(null);

  if (boss.mesh) { scene.remove(boss.mesh); boss.mesh = null; }
  boss.mesh = createBossMonster();
  boss.mesh.position.set(boss.x, 3.05, boss.z);
  scene.add(boss.mesh);
  SND.growl();

  showScreen(null);
  $('bossHud').classList.add('show');
  updateBossBars();
  updateHud();
  setTimeout(requestPointer, 50);
}

function updateBossBars() {
  $('bossHpBar').style.width = Math.max(0, (boss.hp / boss.maxHp) * 100) + '%';
  $('playerHpBar').style.width = Math.max(0, playerHp) + '%';
}
function clearDodgeTimer() {
  if (dodgeInterval) { clearInterval(dodgeInterval); dodgeInterval = null; }
}

function nextQuizQuestion() {
  if (!quizBag.length) {
    var i;
    for (i = 0; i < BOSS_QUESTIONS.length; i++) quizBag.push(i);
    /* shuffle */
    for (i = quizBag.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = quizBag[i]; quizBag[i] = quizBag[j]; quizBag[j] = tmp;
    }
  }
  return BOSS_QUESTIONS[quizBag.pop()];
}

function resolveDodge(correct, chosenIdx, q) {
  if (!dodgeOpen || dodgeAnswered) return;
  dodgeAnswered = true;
  dodgeOpen = false;
  clearDodgeTimer();
  if (correct) {
    mission.bossCorrect++;
    SND.correct();
    playerHp = Math.min(100, playerHp + 8);
    toast((lang === 'en' ? 'Dodged! +8 HP' : '閃避成功！+8 HP'));
    spawnDmgNumber(player.x, player.y + 2.4, player.z, 8, true);
  } else {
    mission.bossWrong++;
    if (q) wrongLog.push({ q: L(q.q), chose: L(q.opts)[chosenIdx] || '—', ans: L(q.opts)[q.a] });
    SND.wrong();
    runPenaltySec += 10;
    updateRunTimerDisplay();
    var oneHit = !relaxedMode && !hasArmour;
    var dmg = oneHit ? 100 : 12;
    playerHp -= dmg;
    hurtFlash();
    shakeT = Math.max(shakeT, 0.4);
    toast(oneHit
      ? (lang === 'en' ? 'No armour! One hit KO · +10 s' : '沒有盔甲！一擊即敗 · +10秒')
      : ((dodgeTimer <= 0.05 ? (lang === 'en' ? 'Too slow! ' : '太慢！') : (lang === 'en' ? 'Wrong! ' : '答錯！')) +
         '−' + dmg + ' HP · +10 s'));
    spawnDmgNumber(player.x, player.y + 2.4, player.z, dmg, false);
    if (playerHp <= 0) {
      updateBossBars();
      loseBoss();
      return;
    }
  }
  updateBossBars();
  showScreen(null);
  $('bossHud').classList.add('show');
  setTimeout(requestPointer, 50);
}

function bossAttack() {
  if (phase !== 'boss' || dodgeOpen || uiOpen || boss.dying > 0) return;
  dodgeOpen = true;
  dodgeAnswered = false;
  dodgeTimer = dodgeMax;
  var q = nextQuizQuestion();
  $('dodgeQ').textContent = L(q.q);
  var fill = $('dodgeTimerFill');
  var lab = $('dodgeTimerLabel');
  var bar = $('dodgeTimerBar');
  fill.style.transform = 'scaleX(1)';
  fill.style.transition = 'none';
  bar.classList.remove('urgent');
  lab.textContent = '10.0 s';
  $('dodgeHint').textContent = relaxedMode ? t('dodgeHint_relaxed')
    : (hasArmour ? t('dodgeHint_std_armour') : t('dodgeHint_std_noarmour'));
  var opts = $('dodgeOpts');
  opts.innerHTML = '';
  L(q.opts).forEach(function (o, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'quiz-opt';
    b.textContent = o;
    b.addEventListener('click', function () { resolveDodge(i === q.a, i, q); });
    opts.appendChild(b);
  });
  SND.growl();
  showScreen('screenDodge');
  $('bossHud').classList.add('show');

  clearDodgeTimer();
  var start = performance.now();
  dodgeInterval = setInterval(function () {
    if (!dodgeOpen || dodgeAnswered) { clearDodgeTimer(); return; }
    var left = Math.max(0, dodgeMax - (performance.now() - start) / 1000);
    dodgeTimer = left;
    fill.style.transform = 'scaleX(' + (left / dodgeMax) + ')';
    lab.textContent = left.toFixed(1) + ' s';
    if (left <= 3) bar.classList.add('urgent');
    if (left <= 0) resolveDodge(false, -1, q);
  }, 50);
}

function meleeBoss() {
  if (phase !== 'boss' || uiOpen || aimZoom || boss.dying > 0) return;
  if (swingState.active) return;
  var w = getWeapon();
  var now = performance.now();
  if (!w || w.type === 'bow') {
    if (now - lastMelee > 700) {
      lastMelee = now;
      toast(w && w.type === 'bow' ? t('holdRMB') : t('equipMelee'));
    }
    return;
  }
  if (now - lastMelee < w.speed) return;
  var dx = player.x - boss.x, dz = player.z - boss.z;
  if (dx * dx + dz * dz > 28) {
    if (now - lastMelee > 700) {
      lastMelee = now;
      toast(t('bossTooFar'));
    }
    return;
  }
  player.facing = Math.atan2(boss.x - player.x, boss.z - player.z);
  lastMelee = now;
  swingState = { active: true, t: 0, hitDone: false, dmg: w.dmg, w: w };
  SND.tone(180, 0.08, 'sawtooth', 0.06, 90);
}

function applyMeleeHit() {
  if (phase !== 'boss' || !swingState.w) return;
  var w = swingState.w;
  var dx = player.x - boss.x, dz = player.z - boss.z;
  if (dx * dx + dz * dz > 32) { toast(t('missed')); return; }
  SND.hit();
  boss.hp -= w.dmg;
  boss.hits++;
  spawnDmgNumber(boss.x, 5.2, boss.z, w.dmg, false);
  spawnGlowBurst(boss.x, 4.2, boss.z, 0xfbbf24, 6);
  if (boss.mesh) {
    boss.mesh.traverse(function (ch) {
      if (ch.material && ch.material.emissive) ch.material.emissiveIntensity = 0.95;
    });
    setTimeout(function () {
      if (!boss.mesh) return;
      boss.mesh.traverse(function (ch) {
        if (ch.material && ch.material.emissive) ch.material.emissiveIntensity = 0.25;
      });
    }, 140);
  }
  updateBossBars();
  if (boss.hp <= 0) winBoss(w);
}

function shootBow() {
  if (phase !== 'boss' || uiOpen || boss.dying > 0) return false;
  var w = getWeapon();
  if (!w || w.type !== 'bow') { toast(t('equipBowFirst')); return false; }
  if (!aimZoom) setAimZoom(true, true);
  var now = performance.now();
  if (now - lastBowShot < Math.min(w.speed, 450)) return false;
  lastBowShot = now;
  var dir = lookDir().normalize();
  var speed = 28;
  var ox = player.x + dir.x * 0.6;
  var oy = player.y + 1.4;
  var oz = player.z + dir.z * 0.6;

  var group = new THREE.Group();
  var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 8),
    new THREE.MeshBasicMaterial({ color: 0xf5f5f4 }));
  shaft.rotation.x = Math.PI / 2;
  group.add(shaft);
  var tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 8), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  tip.rotation.x = Math.PI / 2; tip.position.z = 0.5;
  group.add(tip);
  var fletch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.12), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  fletch.position.z = -0.38;
  group.add(fletch);
  group.position.set(ox, oy, oz);
  group.lookAt(ox + dir.x, oy + dir.y, oz + dir.z);
  scene.add(group);
  SND.shoot();
  arrows.push({
    x: ox, y: oy, z: oz,
    vx: dir.x * speed, vy: dir.y * speed, vz: dir.z * speed,
    dmg: w.dmg, life: 2.5, mesh: group, trail: 0
  });
  return true;
}

function winBoss(w) {
  mission.defeatedBoss = true;
  dodgeOpen = false;
  dodgeAnswered = true;
  stopRunTimer();
  if (aimZoom) setAimZoom(false);
  clearDodgeTimer();
  phase = 'bosswin';
  boss.dying = 1.5;
  boss.lastWeapon = w;
  SND.bossDeath();
  spawnGlowBurst(boss.x, 4.4, boss.z, 0xc084fc, 16);
  spawnGlowBurst(boss.x, 4.0, boss.z, 0xfbbf24, 12);
  shakeT = 0.6;
  $('bossHud').classList.remove('show');
}

function finishWin() {
  phase = 'win';
  if (boss.mesh) { scene.remove(boss.mesh); boss.mesh = null; }
  clearArrows();
  updateMissionPad();
  fillWinScreen();
  showScreen('screenWin');
  SND.fanfare();
}

function loseBoss() {
  dodgeOpen = false;
  dodgeAnswered = true;
  if (aimZoom) setAimZoom(false);
  clearDodgeTimer();
  phase = 'play';
  if (boss.mesh) { scene.remove(boss.mesh); boss.mesh = null; }
  clearArrows();
  $('bossHud').classList.remove('show');
  player.x = 20.5; player.y = 4; player.z = 20.5; player.vy = 0;
  playerHp = 100;
  lastObjectiveKey = '';
  showScreen('screenLose');
}

/* ============================================================
 * 15. Win screen, recap, NSE, exit ticket, teacher report
 * ============================================================ */
function fillWinScreen() {
  var w = boss.lastWeapon;
  $('winStats').innerHTML = t('winStats', {
    w: w ? L(w.name) : '?',
    h: boss.hits,
    a: hasArmour ? t('winStatsArmour') : t('winStatsNoArmour')
  });

  var total = getRunElapsedSec();
  $('winTimeVal').textContent = formatRunTime(total);
  $('winTimeDetail').textContent = t('elapsedPen', {
    t: formatRunTime(total),
    p: runPenaltySec > 0 ? t('includesPen', { n: runPenaltySec }) : t('noPen')
  });

  var best = null;
  try { best = parseFloat(localStorage.getItem(BEST_KEY)); } catch (e) {}
  var note = $('bestTimeNote');
  if (!best || total < best) {
    try { localStorage.setItem(BEST_KEY, String(total)); } catch (e2) {}
    note.textContent = t('newRecord');
  } else {
    note.textContent = t('bestTime', { t: formatRunTime(best) });
  }

  var ul = $('winRecapList');
  ul.innerHTML = '';
  RECAP[lang].forEach(function (line) {
    var li = document.createElement('li');
    li.innerHTML = line;
    ul.appendChild(li);
  });

  $('nseText').textContent = t('nseText');

  /* exit ticket */
  var opts = lang === 'en'
    ? ['Carbon monoxide', 'Coke (carbon)', 'Limestone', 'The hot air']
    : ['一氧化碳', '焦炭（碳）', '石灰石', '熱風'];
  var box = $('exitTicketOpts');
  var msg = $('exitTicketMsg');
  box.innerHTML = '';
  msg.innerHTML = '';
  opts.forEach(function (o, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick-opt';
    b.textContent = o;
    b.addEventListener('click', function () {
      if (i === 0) {
        SND.correct();
        msg.innerHTML = '<div class="msg ok">' + t('exit_ok') + '</div>';
      } else {
        SND.wrong();
        msg.innerHTML = '<div class="msg err">' + t('exit_err') + '</div>';
      }
    });
    box.appendChild(b);
  });

  /* teacher report */
  var lines = [];
  lines.push(t('rep_title'));
  lines.push(t('rep_date') + ': ' + new Date().toLocaleString());
  lines.push(t('rep_mode') + ': ' + (relaxedMode ? t('relaxed') : t('standard')) + ' · Lang: ' + (lang === 'en' ? 'EN' : '中文'));
  lines.push(t('rep_time') + ': ' + formatRunTime(total) +
    (runPenaltySec > 0 ? ' (' + t('rep_pen') + ' +' + runPenaltySec + 's)' : ''));
  lines.push(t('rep_failed') + ': ' + mission.failedHeats);
  lines.push(t('rep_armour') + ': ' + (hasArmour ? t('rep_yes') : t('rep_no')) +
    ' · ' + t('rep_tl') + ': ' + (mission.timelineSolved ? t('rep_yes') : t('rep_no')));
  var mastered = [];
  Object.keys(processMastery).forEach(function (k) {
    if (processMastery[k] && RECIPES_EX[k]) mastered.push(L(RECIPES_EX[k].title));
  });
  lines.push(t('rep_mastered') + ': ' + (mastered.length ? mastered.join('; ') : t('rep_none')));
  lines.push('');
  lines.push(t('rep_wrong') + ' (' + wrongLog.length + '):');
  if (!wrongLog.length) lines.push('  ' + t('rep_none'));
  wrongLog.forEach(function (wr, i2) {
    lines.push('  ' + (i2 + 1) + '. ' + wr.q);
    lines.push('     ✗ ' + wr.chose);
    lines.push('     ✓ ' + wr.ans);
  });
  $('reportBox').value = lines.join('\n');

  $('winMissionSummary').textContent = t('labStats', {
    f: mission.failedHeats, c: mission.bossCorrect, w: mission.bossWrong,
    a: hasArmour ? t('yes') : t('no')
  });
}

function copyReport() {
  var txt = $('reportBox');
  var msg = $('copyMsg');
  function done(ok) {
    msg.textContent = ok ? t('copied') : t('copyFail');
    setTimeout(function () { msg.textContent = ''; }, 2500);
  }
  txt.select();
  txt.setSelectionRange(0, 99999);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt.value).then(function () { done(true); }, function () {
      try { done(document.execCommand('copy')); } catch (e) { done(false); }
    });
  } else {
    try { done(document.execCommand('copy')); } catch (e) { done(false); }
  }
}

/* ============================================================
 * 16. Movement + boss/world update
 * ============================================================ */
function movePlayer() {
  var sprinting = keys.ShiftLeft || keys.ShiftRight || touchSprint;
  var base = sprinting ? SPRINT_SPEED : WALK_SPEED;
  if (aimZoom) base *= 0.45;
  var speed = base * dt;
  var f = flatForward();
  var rx = Math.cos(yaw), rz = Math.sin(yaw);
  var mx = 0, mz = 0, len, tryY, guard, moving = false;
  var stepH = 1.05;
  var sx, sy;

  if (keys.KeyW) { mx += f.x; mz += f.z; }
  if (keys.KeyS) { mx -= f.x; mz -= f.z; }
  if (keys.KeyA) { mx -= rx; mz -= rz; }
  if (keys.KeyD) { mx += rx; mz += rz; }
  if (touchMode && touchStick.active) {
    sx = touchStick.x; sy = touchStick.y;
    if (Math.hypot(sx, sy) > 0.12) {
      mx += (-sy) * f.x + sx * rx;
      mz += (-sy) * f.z + sx * rz;
    }
  }
  len = Math.hypot(mx, mz);
  if (len > 0) {
    moving = true;
    mx = (mx / len) * speed;
    mz = (mz / len) * speed;
    player.facing = Math.atan2(mx, mz);
    if (!collides(player.x + mx, player.y, player.z)) player.x += mx;
    else if (player.onGround && !collides(player.x + mx, player.y + stepH, player.z)) {
      player.x += mx; player.y += stepH;
    }
    if (!collides(player.x, player.y, player.z + mz)) player.z += mz;
    else if (player.onGround && !collides(player.x, player.y + stepH, player.z + mz)) {
      player.z += mz; player.y += stepH;
    }
  }

  player.vy -= GRAVITY * dt;
  if (player.vy < -0.55) player.vy = -0.55;
  tryY = player.y + player.vy;
  if (!collides(player.x, tryY, player.z)) {
    player.y = tryY;
    player.onGround = false;
  } else {
    if (player.vy < 0) {
      player.y = Math.floor(player.y + 0.0001);
      guard = 0;
      while (collides(player.x, player.y, player.z) && guard++ < 40) player.y += 0.05;
      player.onGround = collides(player.x, player.y - 0.08, player.z);
    } else {
      player.onGround = false;
    }
    player.vy = 0;
  }

  if ((keys.Space || touchJump) && player.onGround) {
    player.vy = JUMP_V;
    player.onGround = false;
    touchJump = false;
  }

  if (player.y < 1) { player.y = 1; player.vy = 0; }
  player.x = Math.max(0.5, Math.min(WX - 0.5, player.x));
  player.z = Math.max(0.5, Math.min(WZ - 0.5, player.z));
  guard = 0;
  while (collides(player.x, player.y, player.z) && guard++ < 40) player.y += 0.1;

  updatePlayerVisual(moving);
}

function updateBoss() {
  if (!boss.mesh) return;

  /* death animation */
  if (boss.dying > 0) {
    boss.dying -= dt;
    boss.mesh.position.y -= dt * 1.6;
    boss.mesh.scale.multiplyScalar(Math.max(0.6, 1 - dt * 1.3));
    boss.mesh.rotation.y += dt * 3;
    if (Math.random() < 0.4) spawnGlowBurst(boss.x, 4.2, boss.z, 0xc084fc, 2);
    if (boss.dying <= 0) finishWin();
    return;
  }

  var dx = player.x - boss.x, dz = player.z - boss.z;
  var dist = Math.hypot(dx, dz) || 1;
  var now, i, a, bd, armL, armR, bob;
  boss.x += (dx / dist) * 1.4 * dt;
  boss.z += (dz / dist) * 1.4 * dt;
  boss.anim += dt;
  bob = Math.sin(boss.anim * 3) * 0.08;
  boss.mesh.position.set(boss.x, 3.05 + bob, boss.z);
  boss.mesh.lookAt(player.x, 3.05, player.z);
  armL = boss.mesh.getObjectByName('armL');
  armR = boss.mesh.getObjectByName('armR');
  if (armL) armL.rotation.x = Math.sin(boss.anim * 4) * 0.35;
  if (armR) armR.rotation.x = Math.sin(boss.anim * 4 + Math.PI) * 0.35;

  now = performance.now();
  if (now - boss.lastAttack > 5500) {
    boss.lastAttack = now;
    bossAttack();
  }

  for (i = arrows.length - 1; i >= 0; i--) {
    a = arrows[i];
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.z += a.vz * dt;
    a.vy -= 9 * dt;
    a.life -= dt;
    a.trail = (a.trail || 0) + dt;
    if (a.mesh) {
      a.mesh.position.set(a.x, a.y, a.z);
      a.mesh.lookAt(a.x + a.vx, a.y + a.vy, a.z + a.vz);
    }
    if (a.trail > 0.09) {
      a.trail = 0;
      var spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xfde68a })
      );
      spark.position.set(a.x, a.y, a.z);
      scene.add(spark);
      particles.push({ mesh: spark, vx: 0, vy: 0.2, vz: 0, rot: 0, life: 0.18 });
    }
    bd = Math.hypot(a.x - boss.x, a.z - boss.z);
    var by = a.y - 3.2;
    if (bd < 2.2 && by > -2.2 && by < 2.5) {
      boss.hp -= a.dmg; boss.hits++;
      spawnDmgNumber(boss.x, 5.6, boss.z, a.dmg, false);
      spawnGlowBurst(boss.x, 4.2, boss.z, 0xf97316, 6);
      toast(t('arrowHit', { d: a.dmg }), 900);
      SND.hit();
      updateBossBars();
      if (a.mesh) disposeObject3D(a.mesh);
      arrows.splice(i, 1);
      if (boss.hp <= 0) winBoss(getWeapon());
    } else if (a.life <= 0 || a.y < 0 || a.y > 30) {
      if (a.mesh) disposeObject3D(a.mesh);
      arrows.splice(i, 1);
    }
  }
}

/* animated station bits */
var flickT = 0;
function updateStationAnims() {
  flickT += dt;
  var i;
  /* furnace light flicker + molten pulse */
  var fm = stationModels.furnace;
  if (fm) {
    var fl = fm.getObjectByName('furnaceLight');
    if (fl) fl.intensity = 1.0 + Math.sin(flickT * 9) * 0.2 + Math.random() * 0.15;
    var mp = fm.getObjectByName('moltenPool');
    if (mp) mp.material.emissiveIntensity = 0.85 + Math.sin(flickT * 3) * 0.2;
    var mold = fm.getObjectByName('ingotMould');
    if (mold) mold.material.emissive.setHex(furnacePourT > 0 ? 0xff5a00 : 0x000000);
  }
  /* pour particles */
  if (furnacePourT > 0) {
    furnacePourT -= dt;
    if (Math.random() < 0.5) {
      var fs = STATIONS.furnace;
      spawnGlowBurst(fs.x + 2.2 + Math.random() * 0.5, 4.4, fs.z + 1.5, 0xff7b2d, 1);
    }
  }
  /* kiln glow */
  var km = stationModels.kiln;
  if (km) {
    var kg = km.getObjectByName('kilnGlow');
    if (kg) kg.material.color.setHex(Math.sin(flickT * 7) > 0 ? 0xea580c : 0xc2410c);
  }
  /* generator wheel */
  if (generatorWheel) generatorWheel.rotation.x += dt * 2.2;
  /* cell arcs */
  for (i = 0; i < cellArcSprites.length; i++) {
    cellArcSprites[i].material.opacity = 0.35 + Math.random() * 0.5;
    cellArcSprites[i].scale.setScalar(0.45 + Math.random() * 0.35);
  }
  var cm = stationModels.cell;
  if (cm) {
    var cmol = cm.getObjectByName('cellMolten');
    if (cmol) cmol.material.emissiveIntensity = 0.8 + Math.sin(flickT * 4) * 0.2;
  }
  /* boss crystal spin */
  var bm = stationModels.boss;
  if (bm) {
    var bc = bm.getObjectByName('bossCrystal');
    if (bc) bc.rotation.y += dt * 1.5;
  }
  /* beacon pulse */
  if (beaconMesh && beaconMesh.visible) {
    beaconMesh.material.opacity = 0.12 + (Math.sin(flickT * 2.5) * 0.5 + 0.5) * 0.1;
  }
}

function updateClouds() {
  var i, c;
  for (i = 0; i < clouds.length; i++) {
    c = clouds[i];
    c.position.x += c.userData.vx * dt;
    if (c.position.x > 110) c.position.x = -70;
  }
}

/* ============================================================
 * 17. Input — keyboard / mouse
 * ============================================================ */
function setupInput() {
  var canvas = $('canvas');

  canvas.addEventListener('click', function () {
    if (phase === 'menu' || uiOpen) return;
    if (touchMode || dragLookMode) return;
    if (!pointerLocked) {
      requestPointer();
    }
  });

  document.addEventListener('pointerlockchange', function () {
    pointerLocked = document.pointerLockElement === canvas;
    if (!pointerLocked && !touchMode) {
      mineHeld = false;
      if (aimZoom) setAimZoom(false);
    }
  });

  document.addEventListener('mousemove', function (e) {
    if (touchMode || uiOpen) return;
    if (pointerLocked) {
      var sens = aimZoom ? MOUSE_SENS * 0.55 : MOUSE_SENS;
      yaw += e.movementX * sens;
      pitch -= e.movementY * sens;
      pitch = clamp(pitch, -1.05, 1.2);
      return;
    }
    /* drag-to-look fallback (embedded hubs without pointer lock) */
    if (dragLookMode && dragLookActive) {
      var dx = e.clientX - dragLastX, dy = e.clientY - dragLastY;
      dragLastX = e.clientX; dragLastY = e.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true;
      var s2 = (aimZoom ? MOUSE_SENS * 0.55 : MOUSE_SENS) * 2.4;
      yaw += dx * s2;
      pitch -= dy * s2;
      pitch = clamp(pitch, -1.05, 1.2);
    }
  });

  document.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if ((phase === 'play' || phase === 'boss') && !uiOpen) {
      if (e.code === 'Space' || e.code === 'Tab' || e.code.indexOf('Arrow') === 0) e.preventDefault();
    }
    if (e.code === 'KeyE' && phase === 'play' && !uiOpen) tryInteractStation();
    if (e.code.indexOf('Digit') === 0 && (phase === 'play' || phase === 'boss') && !uiOpen) {
      var n = parseInt(e.code.replace('Digit', ''), 10) - 1;
      equipWeaponSlot(n);
    }
    if (e.code === 'KeyR' && (phase === 'play' || phase === 'boss') && !uiOpen) {
      pitch = 0.2;
      toast(t('cameraReset'));
    }
    if (e.code === 'KeyQ' && phase === 'boss' && !uiOpen) {
      if (aimZoom) setAimZoom(false);
      else if (setAimZoom(true)) aimToggleLock = true;
    }
    if (e.code === 'Escape' && aimZoom) setAimZoom(false);
  });
  document.addEventListener('keyup', function (e) { keys[e.code] = false; });

  window.addEventListener('blur', function () {
    keys = Object.create(null);
    mineHeld = false;
    touchJump = false;
    touchSprint = false;
    touchStick.x = 0; touchStick.y = 0; touchStick.active = false;
    if (aimZoom) setAimZoom(false);
  });

  function onMouseDown(e) {
    if (phase === 'menu' || uiOpen || touchMode) return;
    if (e.button === 2) e.preventDefault();
    if (!pointerLocked) {
      if (dragLookMode) {
        if (e.button === 0) {
          dragLookActive = true; dragMoved = false;
          dragLastX = e.clientX; dragLastY = e.clientY;
          e.preventDefault();
        } else if (e.button === 2) {
          rmbDown = true;
          if (phase === 'boss') {
            var wb = getWeapon();
            if (wb && wb.type === 'bow') setAimZoom(true);
          }
        }
        return;
      }
      requestPointer(); return;
    }
    if (e.button === 2) {
      rmbDown = true;
      if (phase === 'boss') {
        var w = getWeapon();
        if (w && w.type === 'bow') setAimZoom(true);
        else toast(t('equipBowFirst'));
      }
      return;
    }
    if (e.button === 0) {
      e.preventDefault();
      if (phase === 'boss' && (aimZoom || rmbDown)) { shootBow(); return; }
      mineHeld = true;
      if (phase === 'play') mineBlock();
      else if (phase === 'boss') meleeBoss();
    }
  }
  function onMouseUp(e) {
    if (e.button === 0) {
      if (dragLookMode && dragLookActive) {
        dragLookActive = false;
        var wasClick = !dragMoved;
        dragMoved = false;
        if (wasClick && !uiOpen && (phase === 'play' || phase === 'boss')) {
          if (phase === 'boss' && (aimZoom || rmbDown)) { shootBow(); }
          else if (phase === 'play') mineBlock();
          else if (phase === 'boss') meleeBoss();
        }
        return;
      }
      mineHeld = false;
    }
    if (e.button === 2) {
      rmbDown = false;
      if (aimZoom && !aimToggleLock) setAimZoom(false, true);
    }
  }
  canvas.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousedown', function (e) {
    if (touchMode) return;
    if (e.button === 2 && pointerLocked && phase === 'boss' && !uiOpen) {
      e.preventDefault();
      rmbDown = true;
      var w = getWeapon();
      if (w && w.type === 'bow') setAimZoom(true, true);
    }
  });
  canvas.addEventListener('mouseup', onMouseUp);
  document.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('contextmenu', function (e) {
    if (phase === 'play' || phase === 'boss') e.preventDefault();
  });
}

/* ============================================================
 * 18. Input — touch (iPad)
 * ============================================================ */
function setupTouchControls() {
  var joyZone = $('joyZone');
  var joyKnob = $('joyKnob');
  var joyBase = $('joyBase');
  var maxR = 48;
  var TOUCH_SENS = TOUCH_LOOK_SENS;
  var canvas = $('canvas');

  function setKnob(dx, dy) {
    var len = Math.hypot(dx, dy);
    if (len > maxR) { dx = (dx / len) * maxR; dy = (dy / len) * maxR; len = maxR; }
    joyKnob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    touchStick.x = dx / maxR;
    touchStick.y = dy / maxR;
  }
  function resetKnob() {
    joyKnob.style.transform = 'translate(0,0)';
    touchStick.x = 0; touchStick.y = 0; touchStick.active = false; touchStick.id = null;
  }

  joyZone.addEventListener('touchstart', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (uiOpen || (phase !== 'play' && phase !== 'boss')) return;
    var tt = e.changedTouches[0];
    touchStick.id = tt.identifier;
    touchStick.active = true;
    var rect = joyBase.getBoundingClientRect();
    setKnob(tt.clientX - (rect.left + rect.width / 2), tt.clientY - (rect.top + rect.height / 2));
  }, { passive: false });

  function moveJoy(e) {
    if (touchStick.id === null) return;
    var i, tt, rect;
    for (i = 0; i < e.changedTouches.length; i++) {
      tt = e.changedTouches[i];
      if (tt.identifier !== touchStick.id) continue;
      e.preventDefault();
      rect = joyBase.getBoundingClientRect();
      setKnob(tt.clientX - (rect.left + rect.width / 2), tt.clientY - (rect.top + rect.height / 2));
    }
  }
  function endJoy(e) {
    var i, tt;
    for (i = 0; i < e.changedTouches.length; i++) {
      tt = e.changedTouches[i];
      if (tt.identifier === touchStick.id) resetKnob();
    }
  }
  document.addEventListener('touchmove', moveJoy, { passive: false });
  document.addEventListener('touchend', endJoy, { passive: false });
  document.addEventListener('touchcancel', endJoy, { passive: false });

  function isTouchUITarget(el) {
    if (!el || !el.closest) return false;
    return !!(el.closest('#touchUI') || el.closest('#bottomUI') || el.closest('.overlay') ||
      el.closest('#missionPad') || el.closest('#gameTimer') || el.closest('#hotbar') ||
      el.closest('#itemBar') || el.closest('#hudBtns'));
  }

  canvas.style.touchAction = 'none';
  document.body.style.touchAction = 'none';

  canvas.addEventListener('touchstart', function (e) {
    if (uiOpen || phase === 'menu' || phase === 'win') return;
    if (isTouchUITarget(e.target)) return;
    var tt = e.changedTouches[0];
    if (touchStick.id !== null && tt.identifier === touchStick.id) return;
    if (touchLookId !== null) return;
    e.preventDefault();
    touchLookId = tt.identifier;
    touchLookLast = { x: tt.clientX, y: tt.clientY };
  }, { passive: false });

  canvas.addEventListener('touchmove', function (e) {
    if (touchLookId === null || uiOpen) return;
    var i, tt, dx, dy, sens;
    for (i = 0; i < e.changedTouches.length; i++) {
      tt = e.changedTouches[i];
      if (tt.identifier !== touchLookId) continue;
      e.preventDefault();
      if (!touchLookLast) { touchLookLast = { x: tt.clientX, y: tt.clientY }; continue; }
      dx = tt.clientX - touchLookLast.x;
      dy = tt.clientY - touchLookLast.y;
      touchLookLast = { x: tt.clientX, y: tt.clientY };
      sens = aimZoom ? TOUCH_SENS * 0.55 : TOUCH_SENS;
      yaw += dx * sens;
      pitch = clamp(pitch - dy * sens, -1.05, 1.2);
    }
  }, { passive: false });

  function endLook(e) {
    var i, tt;
    for (i = 0; i < e.changedTouches.length; i++) {
      tt = e.changedTouches[i];
      if (tt.identifier === touchLookId) { touchLookId = null; touchLookLast = null; }
    }
  }
  canvas.addEventListener('touchend', endLook, { passive: false });
  canvas.addEventListener('touchcancel', endLook, { passive: false });

  function bindHold(id, onStart, onEnd) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('touchstart', function (e) {
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('on');
      onStart();
    }, { passive: false });
    el.addEventListener('touchend', function (e) {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('on');
      onEnd();
    }, { passive: false });
    el.addEventListener('touchcancel', function () {
      el.classList.remove('on');
      onEnd();
    }, { passive: false });
  }

  bindHold('btnTouchMine', function () {
    if (!canControlGame()) return;
    mineHeld = true;
    if (phase === 'play') mineBlock();
    else if (phase === 'boss' && !aimZoom) meleeBoss();
  }, function () { mineHeld = false; });

  bindHold('btnTouchSprint', function () { touchSprint = true; }, function () { touchSprint = false; });
  bindHold('btnTouchJump', function () { touchJump = true; }, function () { touchJump = false; });

  $('btnTouchUse').addEventListener('touchstart', function (e) {
    e.preventDefault();
    e.stopPropagation();
    tryInteractStation();
  }, { passive: false });

  $('btnTouchAim').addEventListener('touchstart', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (phase !== 'boss' || uiOpen) { toast(t('aimOnlyBoss')); return; }
    if (aimZoom) {
      setAimZoom(false);
      aimToggleLock = false;
    } else if (setAimZoom(true)) {
      aimToggleLock = true;
    }
  }, { passive: false });

  $('btnTouchShoot').addEventListener('touchstart', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (phase !== 'boss' || uiOpen) return;
    if (!aimZoom) setAimZoom(true, true);
    shootBow();
  }, { passive: false });

  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
}

/* ============================================================
 * 19. Main loop
 * ============================================================ */
function gameLoop(ts) {
  requestAnimationFrame(gameLoop);
  try {
    if (!lastFrameTs) lastFrameTs = ts || performance.now();
    var now = ts || performance.now();
    dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTs) / 1000));
    lastFrameTs = now;

    var playing = canControlGame();
    if (touchMode) setTouchUIVisible((phase === 'play' || phase === 'boss') && !uiOpen);

    if (playing) {
      movePlayer();
      updateSwingCombat();
      if (mineHeld && phase === 'play' && !aimZoom) mineBlock();
      if (mineHeld && phase === 'boss' && !aimZoom && !swingState.active) meleeBoss();
    }
    if ((phase === 'boss' || phase === 'bosswin') && !uiOpen) updateBoss();
    if (uiOpen) updateHeating();
    if (phase === 'menu' && playerRig) {
      playerRig.position.set(player.x, player.y, player.z);
      playerRig.rotation.y += 0.5 * dt;
    }

    updateParticles();
    updateSmokes();
    updateDmgFloats();
    updateStationAnims();
    updateClouds();
    if ((phase === 'play' || phase === 'boss') && !uiOpen) emitStationSmoke();
    updatePrompt();
    updateTargetHighlight();
    updateCamera();
    if ($('minimapWrap').classList.contains('show')) drawMinimap();

    /* audio proximity */
    if (SND.ctx) {
      var dF = Math.hypot(player.x - (STATIONS.furnace.x + 0.5), player.z - (STATIONS.furnace.z + 0.5));
      var dC = Math.hypot(player.x - (STATIONS.cell.x + 0.5), player.z - (STATIONS.cell.z + 0.5));
      SND.updateProximity(dF, dC);
    }

    renderer.render(scene, camera);
    if (!window.__firstFrame) window.__firstFrame = performance.now();
  } catch (err) {
    console.error(err);
    window.__renderErrs = (window.__renderErrs || 0) + 1;
    if (window.__renderErrs === 30 && window.__diag) {
      window.__diag('3D rendering keeps failing: ' + (err && err.message ? err.message : err) +
        ' — graphics may be blocked in this embedded browser. (3D 渲染持續失敗)');
    }
  }
}

/* ============================================================
 * 20. Boot + UI wiring
 * ============================================================ */
function toggleLang() {
  lang = lang === 'en' ? 'zh' : 'en';
  applyStaticI18n();
  if (scene) rebuildStationLabels();
  if (phase !== 'menu') {
    updateHud();
    updateMissionPad();
    lastObjectiveKey = '';
  } else {
    updateBestLine();
  }
  var tl = $('screenTimeline');
  if (tl && !tl.classList.contains('hidden')) renderTimeline();
  var lad = $('screenLadder');
  if (lad && !lad.classList.contains('hidden')) openLadder();
}

function updateBestLine() {
  var best = null;
  try { best = parseFloat(localStorage.getItem(BEST_KEY)); } catch (e) {}
  $('bestTimeLine').textContent = best ? t('bestTime', { t: formatRunTime(best) }) : '';
}

function wireUI() {
  $('btnLadder').addEventListener('click', function () { SND.click(); openLadder(); });
  $('btnCloseLadder').addEventListener('click', function () {
    if (uiOpen && !heating) showScreen(null);
    if (phase === 'play' || phase === 'boss') setTimeout(requestPointer, 50);
  });
  $('btnMute').addEventListener('click', function () {
    SND.setMuted(!SND.muted);
    $('btnMute').innerHTML = (SND.muted ? '🔇 ' : '🔊 ') + '<span>' + t('soundBtn') + '</span>';
  });
  $('btnLang').addEventListener('click', toggleLang);
  $('btnLangStart').addEventListener('click', toggleLang);

  $('modeRelaxed').addEventListener('click', function () {
    relaxedMode = true;
    $('modeRelaxed').classList.add('sel');
    $('modeStandard').classList.remove('sel');
    SND.click();
  });
  $('modeStandard').addEventListener('click', function () {
    relaxedMode = false;
    $('modeStandard').classList.add('sel');
    $('modeRelaxed').classList.remove('sel');
    SND.click();
  });

  $('btnHeat').addEventListener('click', startHeating);
  $('btnClearReactor').addEventListener('click', clearReactor);
  $('btnCloseExtract').addEventListener('click', function () {
    if (heating) { toast(t('waitHeat')); return; }
    if (pendingExplain) { toast(t('finishExplain')); return; }
    if (pendingBonus) { toast(t('finishBonus')); return; }
    closeUI();
  });
  $('btnCloseCraft').addEventListener('click', closeUI);
  $('btnCloseGate').addEventListener('click', closeUI);
  $('btnEnterBoss').addEventListener('click', function () {
    showScreen(null);
    startBoss();
  });
  $('btnTlCheck').addEventListener('click', checkTimeline);
  $('btnTlClear').addEventListener('click', clearTimeline);
  $('btnCloseTimeline').addEventListener('click', closeUI);
  $('btnCopyReport').addEventListener('click', copyReport);
  $('btnRestart').addEventListener('click', function () { location.reload(); });
  $('btnRetry').addEventListener('click', function () {
    showScreen(null);
    phase = 'play';
    lastObjectiveKey = '';
    updateHud();
    setTimeout(requestPointer, 50);
  });

  $('btnStart').addEventListener('click', function () {
    showScreen(null);
    phase = 'play';
    player.x = 20.5; player.y = 4; player.z = 20.5; player.vy = 0;
    weapons = [null, null, null, null, null, null];
    hotbarIdx = -1;
    aimZoom = false;
    equippedWeaponId = null;
    hasArmour = false;
    Object.keys(inv).forEach(function (k) { inv[k] = 0; });
    Object.keys(mission).forEach(function (k) {
      mission[k] = typeof mission[k] === 'number' ? 0 : false;
    });
    Object.keys(discoveredCards).forEach(function (k) { discoveredCards[k] = false; });
    tlPlacement = [null, null, null, null, null];
    processMastery = {};
    processSuccessCount = {};
    wrongLog = [];
    quizBag = [];
    lastObjectiveKey = '';

    $('hud').classList.add('show');
    $('hudBtns').classList.add('show');
    $('crosshair').classList.add('show');
    $('crosshair').classList.remove('aim');
    $('bottomUI').classList.add('show');
    $('minimapWrap').classList.add('show');
    $('missionPad').classList.add('show');
    $('aimBanner').classList.remove('show');
    updateMissionPad();
    updateHud();
    SND.ensure();
    SND.startLoops();
    startRunTimer();
    touchMode = isTouchDevice();
    setTouchUIVisible(touchMode && (phase === 'play' || phase === 'boss'));
    if (touchMode) toast(t('touchToast'), 4200);
    else if (dragLookMode) {
      toast(t('dragLookToast'), 5200);
      setTimeout(requestPointer, 50);
    }
    else {
      toast(t('timerStarted'), 3600);
      setTimeout(requestPointer, 50);
    }
  });
}

function closeUI() {
  if (heating) { toast(t('waitHeat')); return; }
  if (pendingExplain) { toast(t('finishExplain')); return; }
  if (pendingBonus) { toast(t('finishBonus')); return; }
  showScreen(null);
  if (phase === 'play' || phase === 'boss') setTimeout(requestPointer, 50);
}

/* ---- go ---- */
touchMode = isTouchDevice();
/* Embedded hubs (iframes) usually block pointer lock → enable drag-to-look fallback */
try {
  if (!touchMode && window.self !== window.top) dragLookMode = true;
} catch (e) { dragLookMode = true; }
minimapCtx = $('minimapCanvas') ? $('minimapCanvas').getContext('2d') : null;
buildMinimapBase();
initThree();
setupInput();
setupTouchControls();
wireUI();
applyStaticI18n();
updateBestLine();
$('libStatus').textContent = touchMode ? t('libReadyTouch')
  : (dragLookMode ? 'Ready — embedded mode: drag to look, click to mine.' : t('libReadyPC'));
$('btnStart').disabled = false;
gameLoop(performance.now());
/* Watchdog: if nothing has rendered within 8 s, surface a readable diagnosis */
setTimeout(function () {
  if (!window.__firstFrame && window.__diag) {
    window.__diag('The 3D view did not start within 8 seconds — likely a WebGL/graphics problem in this browser. (3D 畫面未能啟動)');
  }
}, 8000);

}; /* end __startMetalQuest */
