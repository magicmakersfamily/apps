import json, re, copy, sys, os, warnings
warnings.filterwarnings('ignore')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import content_en
import pycantonese as pc

EN = content_en.chapters
# ---- Cantonese (written Cantonese, Traditional characters) for each chapter, same order as the English ----
Y = [
 dict(title="大爆炸同早期宇宙", shortTitle="1. 大爆炸", orderName="大爆炸", timeLabel="138億年前", gapNote="最最最開始",
  mascotSpeech="㩒一下個發光嘅小點，就可以開始喇！宇宙一開始又細又熱，所有嘢都迫埋一齊。",
  afterBang="成個宇宙原本又細又熱又迫。跟住，空間本身開始脹大，喺每個地方同時脹！大爆炸唔係喺空間入面爆炸嘅炸彈，而且宇宙冇中心㗎！而家㩒四粒氫原子，將佢哋擠埋一齊，點亮第一粒星！",
  minigameTitle="⭐ 點亮第一粒星！", minigameDesc="㩒 4 粒氫原子，佢哋會擠埋一齊，變成一粒發光嘅星！",
  payoff="氫原子擠得好實，就發出光同熱。科學家叫呢個做核聚變。第一粒星亮起嚟喇！我哋嘅太陽都係咁發光㗎。",
  hotspots=[("空間脹大咗！","大爆炸之後，空間好快咁脹大，好似吹氣球咁。科學家叫呢個做暴脹。","你身體入面嘅氫嚟自大爆炸。你身體入面嘅碳同氧，就喺恆星入面造出嚟㗎！"),
            ("第一批恆星","重力將一團團氫氣拉埋一齊，擠得好實，就亮起嚟，變成第一批恆星。","恆星會聚埋一齊，組成巨大嘅星系。我哋嘅銀河系有幾千億粒恆星！")],
  centre=("最初嘅一點","一切由一個又細又熱又迫嘅開始。空間同時間都喺嗰刻開始，所以根本冇「外面」可以爆出去。","冇中心，冇邊緣：係空間本身喺每個地方同時脹大！"),
  talk="💬 一齊傾吓：第一粒星係點樣亮起嚟㗎？", cal="1月1日：大爆炸",
  bigQ=("大爆炸之前有啲乜嘢呢？","冇人知道呀！科學可以講到大爆炸之後好短嘅一刻發生咗乜嘢，但係之前有啲乜，係最大嘅謎團之一。","話唔定將來有一位小朋友可以幫手解開呢個謎！")),
 dict(title="太陽系同地球嘅形成", shortTitle="2. 地球同月球", orderName="地球同月球", timeLabel="45億年前", gapNote="大爆炸之後90億年",
  mascotSpeech="太陽亮起嚟喇！佢周圍嘅氣體同塵埃凝成石頭，石頭又撞埋一齊變成更大嘅石頭。㩒一下啲太空石，砌出年輕嘅地球啦！",
  minigameTitle="🪨 砌地球！", minigameDesc="㩒啲太空石。每一粒都會黐落去，地球就大啲！",
  payoff="一粒又一粒石頭黐埋一齊，年輕嘅地球越嚟越大、越嚟越熱。跟住，一個好似火星咁大嘅天體「忒伊亞」撞咗上嚟。科學家認為，撞出嚟嘅發光碎屑，就變成咗我哋嘅月球！",
  hotspots=[("年輕嘅太陽","一大團旋轉緊嘅氣體同塵埃跌埋一齊，亮起嚟就變成我哋嘅太陽。","太陽入面可以裝落大約一百萬個地球！"),
            ("月球點樣嚟？","科學家認為，一個好似火星咁大嘅天體「忒伊亞」撞咗年輕嘅地球。撞出嚟嘅發光碎屑聚埋一齊，就變成月球。","嗰陣時月球離地球近好多，而家佢每年都仲係遠離少少。")],
  centre=("年輕嘅熔岩地球","年輕嘅地球熱到成個表面都係發光嘅熔岩。","月球幫地球保持傾斜角度穩定，所以我哋有溫和嘅四季！"),
  talk="💬 一齊傾吓：你覺得啱啱形成嘅地球，睇落去同感覺係點樣㗎？", cal="約9月3日：太陽同地球出現",
  bigQ=("點解啲石頭會黐埋一齊呢？","因為重力！每一塊石頭都拉住其他石頭。大嘅石頭拉力更大，所以愈拉愈多，最後變成行星。","重力亦令行星變成圓形：因為佢將所有嘢都拉向中心。")),
 dict(title="變涼嘅海洋同第一批微生物", shortTitle="3. 最早嘅微生物", orderName="微細生命", timeLabel="至少35億年前", gapNote="地球形成之後大約10億年",
  mascotSpeech="地球凍咗落嚟，雨水注滿咗海洋。喺暖暖嘅海水入面，出現咗最早嘅細小生命。後嚟，有啲細胞學識用陽光製造氧氣！㩒啲養分嚟餵佢哋。",
  minigameTitle="🧪 海洋配方！", minigameDesc="㩒啲浮緊嘅養分嚟餵細胞，睇住氧氣泡泡升起嚟！",
  payoff="細小嘅細胞用陽光製造食物，仲放出氧氣泡泡。空氣慢慢充滿咗氧氣。呢個改變咗地球，因為將來動物要靠氧氣呼吸！",
  hotspots=[("深海噴口","熱水同礦物質由海底嘅煙囪冒出嚟。科學家認為，最早嘅細小生命可能就住喺類似嘅地方。","有啲細小嘅生物，今日仲住喺沸騰嘅溫泉入面！"),
            ("製造氧氣嘅小幫手","藍綠菌係好細小嘅生物，佢哋用陽光製造食物，同時放出氧氣。呢個過程叫光合作用。","喺佢哋出現之前，地球嘅空氣差唔多冇氧氣！")],
  centre=("遠古海洋","雨水落咗好耐，注滿咗巨大嘅海洋。生命就喺嗰度開始。","海洋今日覆蓋地球表面超過七成！"),
  talk="💬 一齊傾吓：空氣入面充滿氧氣之後，你覺得地球有啲乜嘢改變？", cal="約9月29日：第一批細小嘅細胞",
  bigQ=("生命係點開始㗎？","科學家都仲喺度研究緊！好多人認為，簡單嘅化學物質喺暖水入面混合，可能喺海底噴口附近，慢慢形成最早嘅細胞。","仲有好多嘢等人發現，呢個先係最好玩嘅地方！")),
 dict(title="海洋生物增多，之後生命登陸", shortTitle="4. 由海到陸", orderName="海洋動物", timeLabel="5.4億年前", gapNote="最早嘅微生物之後30億年",
  mascotSpeech="海洋入面出現咗好多新動物，有殼、有眼、有鰭。好耐好耐之後，有啲魚有強壯嘅骨鰭，住喺淺水。佢哋嘅後代變成有四條腿嘅動物！㩒一下啲海洋生物。",
  minigameTitle="🐠 上岸探險隊！", minigameDesc="㩒啲海洋生物。一代又一代，佢哋嘅身體會變少少！",
  payoff="一代又一代，鰭比較強壯嘅魚喺淺水過得好啲。經過幾百萬年，佢哋嘅後代生出腳，行上陸地。科學家叫呢個做演化。",
  hotspots=[("三葉蟲","三葉蟲有硬殼同靈活嘅眼睛，喺暖暖嘅淺海爬行同游水。","三葉蟲喺地球嘅海洋住咗大約兩億七千萬年！"),
            ("最早嘅森林","苔蘚，之後係蕨類同樹木，喺陸地上生長，將光禿禿嘅石頭變成綠色。","嗰陣時嘅巨型蜻蜓，翼展好似烏鴉咁闊！")],
  centre=("早期嘅綠色陸地","植物蔓延到陸地上，令空氣入面有更多氧氣。","嗰陣時嘅森林製造咗好多氧氣，連昆蟲都變到巨型！"),
  talk="💬 一齊傾吓：你最想遇到邊一種遠古嘅海洋動物呢？", cal="12月17日：海洋動物大量出現。12月21日：動物登陸",
  bigQ=("魚係咪「決定」生出腳㗎？","唔係喎！魚唔會自己揀。鰭強壯少少嘅魚，喺淺水更容易搵到食物，生到更多仔女。經過幾百萬年，身體就慢慢改變，呢個就係演化。","演化係成個家族、經過好長好長時間先發生，唔係一隻動物自己變。")),
 dict(title="恐龍時代同滅絕", shortTitle="5. 恐龍時代", orderName="恐龍", timeLabel="約2.3億至6600萬年前", gapNote="動物登陸之後大約1.5億年",
  mascotSpeech="吼！好似霸王龍同三角龍呢啲巨大嘅恐龍，統治咗地球超過一億六千五百萬年。跟住，有啲好大嘅嘢從太空飛嚟。㩒一下啲小行星，將佢哋搵出嚟！",
  minigameTitle="☄️ 小行星觀察站！", minigameDesc="搵出飄過嘅太空石，逐粒㩒一下！",
  payoff="但係有一粒小行星大到根本攔唔到，闊度大約六英里。佢撞落墨西哥，改變咗地球嘅天氣，巨型恐龍就絕種咗。細隻嘅有羽毛恐龍生存咗落嚟。今日我哋叫佢哋做鳥！",
  hotspots=[("霸王龍","係最大嘅陸上獵食者之一！恐龍統治地球超過一億六千五百萬年。","鳥類係恐龍嘅親戚，佢哋嚟自細隻嘅有羽毛恐龍！"),
            ("巨大嘅小行星","一塊巨大嘅太空石撞落而家嘅墨西哥，改變咗地球嘅天氣，大型恐龍嘅時代就結束咗。","呢粒小行星嘅闊度，大約同珠穆朗瑪峰嘅高度差唔多！")],
  centre=("恐龍世界","又暖又綠又有火山嘅土地，巨大嘅恐龍喺度生活咗超過一億六千五百萬年。","一隻霸王龍嘅牙齒連埋牙根，可以長到好似香蕉咁長！"),
  talk="💬 一齊傾吓：點解有啲細隻嘅動物生存到，大隻嘅恐龍就唔得呢？你點睇？", cal="12月25日至29日：恐龍時代",
  bigQ=("恐龍有冇可能阻止小行星呢？","冇可能。佢大約六英里闊，速度快到難以想像，地球上冇乜嘢可以攔住佢。不過細隻嘅有羽毛恐龍生存咗落嚟，而今日嘅鳥，就係佢哋嘅後代。","所以恐龍到今日仲喺度呀！望吓窗外，可能就見到一隻！")),
 dict(title="哺乳動物、人類同未來", shortTitle="6. 人類同太空", orderName="人同火箭", timeLabel="6600萬年前至今日", gapNote="哺乳動物遍佈地球6600萬年，人類好近期先出現",
  mascotSpeech="恐龍之後，哺乳動物散佈到世界各地。好耐好耐之後，人類出現喇！世界各地嘅人學習、分享諗法、發明新嘢，每一個諗法都帶出下一個。㩒一下啲靈感火花，發射火箭啦！",
  minigameTitle="🚀 諗法帶火箭上太空！", minigameDesc="㩒啲靈感火花。用火、分享、望遠鏡……每個諗法都令我哋近啲太空！",
  payoff="三、二、一、發射！世界各地嘅人不斷學習同分享諗法，終於去到太空。你係宇宙嘅一部分，仲要係識得好奇宇宙嘅一部分！你想發現啲乜呢？",
  hotspots=[("冰河時期嘅哺乳動物","毛茸茸嘅長毛象同劍齒虎，喺寒冷嘅冰河時期生活。","有啲長毛象，喺埃及人起金字塔嘅時候仲生存緊！"),
            ("探索太空","人類由識得用火，去到登陸月球，仲發射太空望遠鏡嚟研究星星。","旅行者一號而家離地球超過一百五十億英里！")],
  centre=("我哋嘅地球","地球有海洋、森林、城市，仲有飛向星星嘅太空船。","地球係我哋所知，宇宙入面唯一有生命嘅地方！"),
  talk="💬 一齊傾吓：你最鍾意故事入面邊一部分？你想人類下一步發現啲乜？", cal="12月31日晚上11時49分：人類出現",
  bigQ=("你想人類下一步發現啲乜？","可能係生命點樣開始、治好一種病，或者一個新嘅世界。世界各地嘅人不停學習同分享。你係宇宙嘅一部分，而且係識得好奇宇宙嘅一部分！","你想探索啲乜呢？")),
]

def merge(en, y):
    c = copy.deepcopy(en)
    for k in ('title','shortTitle','orderName','timeLabel','gapNote','mascotSpeech','minigameTitle','minigameDesc','payoff'):
        c[k] = y[k]
    if 'afterBang' in y: c['afterBang'] = y['afterBang']
    for h, (t, b, f) in zip(c['hotspots'], y['hotspots']): h['title'], h['body'], h['funFact'] = t, b, f
    c['centre']['title'], c['centre']['body'], c['centre']['funFact'] = y['centre']
    c['bigQ'] = dict(q=y['bigQ'][0], a=y['bigQ'][1], f=y['bigQ'][2])
    c['talk'] = y['talk']; c['cal'] = y['cal']
    return c
YUE = [merge(e, y) for e, y in zip(EN, Y)]

# ---- interface strings ----
UI = {
 'en': dict(
  fusion_label='H + H + H + H → He + light', gen_label='generation after generation', surv_label='small feathered survivors', ladder_label='each idea leads to the next',
  settings_title='Settings', set_lang='Language', set_sound='Sound effects', set_voice='Cosmo’s voice', set_music='Music', set_jp='Jyutping', set_easy='Easy & calm mode',
  set_easy_d='Slower things, bigger targets, less movement.', on='On', off='Off', t_settings='Settings',
  cal_btn='One year', cal_title='📅 The universe in one year', cal_intro='Imagine the whole story squeezed into one year. Zoom in to see how late people arrive!',
  cal_bar1='The whole year', cal_bar2='December', cal_bar3='31 December', cal_last='The very last second: rockets and the Moon landing',
  v_cal='If the whole story of the universe were squeezed into one year, the Big Bang would be on the first of January. Dinosaurs would arrive on Christmas Day. And people would appear just eleven minutes before midnight on New Year’s Eve!',
  lang_label='Language', trigger='👉 Touch here to trigger the Big Bang! 👈', ov_title='Welcome, Cosmic Explorer!',
  ov_text='Travel from the Big Bang to today with Cosmo the Cosmic Cat, your storyteller!',
  ov_btn='Tap the glowing dot to begin!', ov_note='Sound, voice and music start when you tap. You can turn them off in Settings (the gear).',
  all_apps='← All apps', sub='Interactive universe & Earth story', start_over='Start over', how_to_play='How to Play',
  hear='Hear Cosmo', bigq='Big question', cosmo='Cosmo', ok='Awesome! Got it!', funfact='Fun fact!', again='💥 Start again',
  tell='Tell a friend', more='More from the App Shelf', see_all='See all the apps', about_btn='About',
  t_sound='Sound effects on/off', t_voice='Cosmo’s voice on/off', t_music='Background music on/off', t_stickers='Sticker book', t_help='How to play', t_jp='Jyutping on/off', close='Close',
  prev='← Previous', next='Next Chapter →', restart_j='Restart Journey ↻',
  cap1='Tiny, hot and crowded…', cap2='Space itself stretches, everywhere at once! There is no middle.', cap3='It cools down. Tiny pieces join up as hydrogen.',
  ent0='Hydrogen', ent1='Space rock', ent2='Nutrient', ent3='Sea creature', ent4='Asteroid', ent5='Idea spark',
  b_discovery='Discovery!', b_bigq='Big question', b_help='How to play', prof='Professor Know-A-Lot', ask_prof='Ask the Professor', hear_prof='Hear the Professor', prof_short='Professor', b_word='New word', asks='asks',
  help_title='How to play & learn',
  help_body='1. Tap the glowing dot to start the Big Bang.\n2. In each chapter, tap the floating things and watch what you make happen.\n3. Tap the glowing circles for fun facts, and Cosmo’s Big question for a puzzle to think about.\n4. Collect stickers, and use the story line at the bottom to see how long ago things happened.',
  help_fun='No sound? Check that your device isn’t on silent and the volume is up, then tap “Hear Cosmo”.',
  sticker_title='📒 My Sticker Book', sticker_intro='{n} of {m} stickers collected.', locked='Not yet', got='Collected!', toast_new='New sticker!',
  order_title='Put the story in order', order_intro='Tap the cards in the order they happened. What came first?', order_yes='Yes! And what came next?',
  order_no='Not quite yet. Think about what came before this one!', order_hint='Here is a hint: look for the glowing card.', order_done='You put the whole story in order! Great job, explorer!',
  about_title='About Cosmic Journey',
  about_text='A story of the universe in six chapters. Finish each chapter’s challenge to collect stickers. It is a beta: we are still testing it with kids and improving it. Tell us what you think with the links at the bottom of the page.',
  done_title='You travelled 13.8 billion years!', done_text='From a tiny hot dot to stars, Earth, dinosaurs, people and rockets: you saw it all. What do you want to discover next?',
  v_final='You did it! You travelled all the way from the Big Bang to today! What do you want to discover next?',
  v_orderok='You put the whole story in order. Great job, explorer!',
  v_help='How to play and learn. Tap the glowing dot to start the Big Bang. In each chapter, tap the floating things and watch what you make happen. Tap the glowing circles for fun facts, and Cosmo’s Big question for a puzzle to think about. Collect stickers, and use the story line at the bottom to see how long ago things happened.',
  st_tap='Tap “Hear Cosmo” to turn on his voice.', st_novoice='No voice started. Tap “Hear Cosmo” to try again, or read his words.',
  st_fail='Cosmo’s voice isn’t working on this device. You can read his words instead.', st_nosynth='This browser can’t speak out loud. You can read Cosmo’s words instead.',
  tl_aria='Story line: how long ago each chapter happened. The long gaps are squashed so they fit.', jp_btn='Jyutping'),
 'yue': dict(
  fusion_label='H + H + H + H → He + 光同熱', gen_label='一代又一代', surv_label='細隻嘅有羽毛恐龍生存咗落嚟', ladder_label='每個諗法都帶出下一個',
  settings_title='設定', set_lang='語言', set_sound='音效', set_voice='宇宙貓旁白', set_music='背景音樂', set_jp='粵拼', set_easy='輕鬆慢速模式',
  set_easy_d='慢啲、大啲、少啲郁動。', on='開', off='關', t_settings='設定',
  cal_btn='一年', cal_title='📅 宇宙嘅一年', cal_intro='想像成個宇宙故事壓縮成一年。放大睇吓，人類幾咁遲先出現！',
  cal_bar1='成年', cal_bar2='12月', cal_bar3='12月31日', cal_last='最後嗰一秒：火箭同登陸月球',
  v_cal='如果將成個宇宙嘅故事壓縮成一年，大爆炸喺一月一號。恐龍喺聖誕節先出現。而人類呢，要到除夕夜晚，差十一分鐘就十二點先出現！',
  lang_label='語言', trigger='👉 㩒呢度，開始大爆炸！ 👈', ov_title='歡迎你，宇宙探險家！',
  ov_text='由大爆炸一路旅行到今日，宇宙貓同你講故事！',
  ov_btn='㩒一下發光嘅小點，開始冒險！', ov_note='㩒咗先會有音效、旁白同音樂。你可以喺「設定」（齒輪）度關掉。',
  all_apps='← 所有遊戲', sub='互動宇宙同地球故事', start_over='重新開始', how_to_play='玩法',
  hear='聽宇宙貓講', bigq='大問題', cosmo='宇宙貓', ok='好嘢！明白喇！', funfact='你知唔知？', again='💥 再玩一次',
  tell='話俾朋友知', more='更多遊戲', see_all='睇晒所有遊戲', about_btn='關於',
  t_sound='音效 開／關', t_voice='宇宙貓旁白 開／關', t_music='背景音樂 開／關', t_stickers='貼紙簿', t_help='玩法', t_jp='粵拼 開／關', close='關閉',
  prev='← 上一章', next='下一章 →', restart_j='重新旅行 ↻',
  cap1='又細又熱又迫……', cap2='空間本身喺每個地方同時脹大！冇中心㗎。', cap3='慢慢變涼，細細粒嘅嘢結合成氫。',
  ent0='氫原子', ent1='太空石', ent2='養分', ent3='海洋生物', ent4='小行星', ent5='靈感火花',
  b_discovery='新發現！', b_bigq='大問題', b_help='玩法', prof='知得多教授', ask_prof='問吓教授', hear_prof='聽教授講', prof_short='教授', b_word='新詞語', asks='問',
  help_title='玩法同學習',
  help_body='1. 㩒一下發光嘅小點，開始大爆炸。\n2. 每一章都㩒一下浮緊嘅嘢，睇吓你整出啲乜。\n3. 㩒發光嘅圈圈睇有趣知識；㩒「大問題」有啲嘢可以諗吓。\n4. 儲貼紙；睇吓下面嘅故事線，就知道嗰啲事喺幾耐之前發生。',
  help_fun='冇聲？睇吓部機有冇靜音、音量夠唔夠，再㩒「聽宇宙貓講」。',
  sticker_title='📒 我嘅貼紙簿', sticker_intro='儲咗 {n} / {m} 張貼紙。', locked='未有', got='儲到喇！', toast_new='新貼紙！',
  order_title='將故事排好次序', order_intro='按事情發生嘅次序㩒啲卡。邊個最先？', order_yes='啱喇！跟住係邊個？',
  order_no='未得喎，諗吓邊個喺呢個之前發生！', order_hint='提示：搵發光嗰張卡。', order_done='你將成個故事排好晒次序！好叻呀，探險家！',
  about_title='關於宇宙之旅',
  about_text='宇宙之旅有六個章節。完成每一章嘅挑戰就可以儲貼紙。呢個係測試版，我哋仲同小朋友一齊測試同改善緊。你嘅意見可以用頁底嘅連結話俾我哋知。',
  done_title='你旅行咗138億年！', done_text='由一個又細又熱嘅小點，去到恆星、地球、恐龍、人類同火箭：你全部都睇晒喇！你想發現啲乜呢？',
  v_final='你做到喇！你由大爆炸一路旅行到今日！你想發現啲乜呢？',
  v_orderok='你將成個故事排好晒次序。好叻呀，探險家！',
  v_help='玩法。㩒一下發光嘅小點，開始大爆炸。每一章都㩒一下浮緊嘅嘢，睇吓你整出啲乜。㩒發光嘅圈圈睇有趣知識，仲有宇宙貓嘅大問題等你諗。儲貼紙，睇吓下面嘅故事線，就知道嗰啲事喺幾耐之前發生。',
  st_tap='㩒「聽宇宙貓講」開聲。', st_novoice='冇聲音。㩒「聽宇宙貓講」再試吓，或者睇吓佢講乜。',
  st_fail='呢部機未能夠播放宇宙貓嘅聲音。你可以睇吓佢講乜。', st_nosynth='呢個瀏覽器唔能夠讀出聲。你可以睇吓宇宙貓講乜。',
  tl_aria='故事線：每一章係幾耐之前發生。好長嘅時間畫短咗，先放得落。', jp_btn='粵拼'),
}
STK = {  # id: (en name, en how, yue name, yue how)
 'c0': ('First Star','Light the first star (chapter 1)','第一粒星','點亮第一粒星（第1章）'),
 'c1': ('Moon Maker','Build Earth (chapter 2)','月球製造師','砌地球（第2章）'),
 'c2': ('Oxygen Maker','Feed the tiny cells (chapter 3)','氧氣製造師','餵細胞（第3章）'),
 'c3': ('Shore Walker','Finish chapter 4','上岸先鋒','完成第4章'),
 'c4': ('Asteroid Spotter','Finish chapter 5','小行星觀察員','完成第5章'),
 'c5': ('Rocket Pilot','Fuel the rocket (chapter 6)','火箭師','幫火箭加燃料（第6章）'),
 'q0': ('Bang Detective','Open both fun-fact circles in chapter 1','大爆炸偵探','打開第1章兩個知識圈'),
 'q1': ('Earth Detective','Open both fun-fact circles in chapter 2','地球偵探','打開第2章兩個知識圈'),
 'q2': ('Microbe Detective','Open both fun-fact circles in chapter 3','微生物偵探','打開第3章兩個知識圈'),
 'q3': ('Ocean Detective','Open both fun-fact circles in chapter 4','海洋偵探','打開第4章兩個知識圈'),
 'q4': ('Dino Detective','Open both fun-fact circles in chapter 5','恐龍偵探','打開第5章兩個知識圈'),
 'q5': ('Space Detective','Open both fun-fact circles in chapter 6','太空偵探','打開第6章兩個知識圈'),
 'order': ('Story Master','Put the story in order at the end','故事大師','喺最後將故事排好次序'),
}
STK_T = {'en': {k: [v[0], v[1]] for k, v in STK.items()}, 'yue': {k: [v[2], v[3]] for k, v in STK.items()}}

# ---- Jyutping per character (from the pycantonese / rime-cantonese dictionary) ----
HAN = re.compile(r'[㐀-鿿\U00020000-\U0002ffff]')
def jyut(s):
    # whitespace (spaces, newlines) is kept as an empty slot; the dictionary is run on each stretch of text between
    res = []
    for seg in re.split(r'(\s+)', s):
        if not seg: continue
        if seg.isspace(): res += [''] * len(seg)
        else: res += jyut_seg(seg)
    assert len(res) == len(list(s)), s
    return '|'.join(res)

def jyut_seg(s):
    out = []
    for word, jp in pc.characters_to_jyutping(s):
        chars = list(word)
        if jp is None:
            out += [''] * len(chars); continue
        syl = re.findall(r'[a-z]+[1-6]', jp)
        han = [c for c in chars if HAN.match(c)]
        if len(syl) == len(han):
            it = iter(syl); out += [next(it) if HAN.match(c) else '' for c in chars]
        else:
            for c in chars:
                if HAN.match(c):
                    r = pc.characters_to_jyutping(c); j = re.findall(r'[a-z]+[1-6]', r[0][1] or '')
                    out.append(j[0] if j else '')
                else: out.append('')
    assert len(out) == len(list(s)), s
    return out

def all_yue_strings():
    S = set()
    for c in YUE:
        for k in ('title','shortTitle','orderName','timeLabel','gapNote','mascotSpeech','afterBang','minigameTitle','minigameDesc','payoff','talk','cal'):
            if k in c: S.add(c[k])
        for h in c['hotspots']: S.update([h['title'], h['body'], h['funFact']])
        for h in c['hotspots']:
            if 'ask' in h: S.add(h['ask'])
            if 'more' in h: S.add(h['more'])
        if 'ask' in c['centre']: S.add(c['centre']['ask'])
        if 'gloss' in c: S.update([c['gloss']['word'], c['gloss']['ask'], c['gloss']['answer']])
        S.update([c['centre']['title'], c['centre']['body'], c['centre']['funFact'], c['bigQ']['q'], c['bigQ']['a'], c['bigQ']['f']])
    for k, v in UI['yue'].items():
        if k.startswith(('v_', 'tl_', 't_')): continue
        S.add(v)
    S.update(v[0] for v in STK_T['yue'].values())
    S.update(v[1] for v in STK_T['yue'].values())
    return S
JP = {}

def js():
    if not JP:
        for s in sorted(all_yue_strings()): JP[s] = jyut(s)
    dumps = lambda x: json.dumps(x, ensure_ascii=False, indent=1)
    return ("const CHAPTERS_YUE = " + json.dumps(YUE, ensure_ascii=False, indent=4) + ";\n"
            "const UI = " + dumps(UI) + ";\n"
            "const STICKER_TEXT = " + dumps(STK_T) + ";\n"
            "const JP = " + json.dumps(JP, ensure_ascii=False, separators=(',', ':')) + ";")

# ---- grown-ups layer, in Cantonese ----
EXTRAS_Y = [
 dict(because="空間脹大同變涼，氫就可以聚埋一齊，第一批星就可以亮起嚟。",
  prompts=["如果空間脹大，咁中心喺邊度呢？（冇中心。你可以喺氣球上面畫啲點，再吹大佢睇吓。）","你覺得「冇人知」大爆炸之前有啲乜，係咩意思呢？"],
  words=[["氫","宇宙入面最輕、最多嘅原子"],["核聚變","原子擠得好實，就會發出光同熱"],["星系","由重力拉埋一齊嘅一大班恆星"]],
  known="宇宙大約喺138億年前開始，之後一直脹大。第一批恆星由氫同氦組成。", open="大爆炸係點樣發生，同埋之前有啲乜。",
  more=["科學家叫呢種極快嘅脹大做暴脹。佢可能只係維持咗一瞬間，但已經為成個宇宙打好基礎：早期宇宙入面細細嘅差異，後來變成咗星系。空間而家仲喺度脹大，所以遠方嘅星系越行越遠。","最早嘅恆星可能好巨大，而且壽命好短。佢哋結束嘅時候，將碳同氧等新材料撒出去，後來就變成行星同人。"]),
 dict(because="重力令石頭黐埋一齊，地球就可以越嚟越大，而一次大碰撞就造出咗月球。",
  prompts=["點解行星係圓嘅？（因為重力將所有嘢拉向中心。）","一粒石頭黐落地球，同雪球越滾越大，有啲咩相似？"],
  words=[["重力","所有有質量嘅嘢之間互相拉住嘅力"],["忒伊亞","科學家畀嗰個可能撞過地球、好似火星咁大嘅天體嘅名"],["熔岩","熱到石頭都融化咗"]],
  known="地球同其他行星大約喺45億年前，由一團旋轉緊嘅氣體同塵埃形成。", open="月球究竟係點形成？巨型碰撞係最主流嘅講法，科學家仲繼續驗證緊。",
  more=["太陽係一粒中等大細嘅恆星，大約46億歲，一生差唔多行咗一半。佢喺核心將氫變成氦，同你喺第一粒星見到嘅核聚變一樣。","電腦模擬顯示，巨型碰撞嘅結果同月球石頭同地球石頭好相似呢個發現吻合。呢個係目前最好嘅解釋，不過科學家仲繼續測試。"]),
 dict(because="細小嘅細胞用陽光製造氧氣，空氣就慢慢改變，將來動物先可以呼吸。",
  prompts=["你覺得未有氧氣之前，地球嘅天空係點樣？","而家嘅植物都製造氧氣，同嗰啲細小嘅細胞有啲咩相似？"],
  words=[["微生物","細到要用顯微鏡先睇到嘅生物"],["氧氣","空氣入面，大部分動物要用嚟呼吸嘅氣體"],["光合作用","用陽光製造食物"]],
  known="至少35億年前已經有生命，細小嘅細胞用好長時間令空氣充滿氧氣。", open="生命究竟係點開始，同埋喺幾時開始。",
  more=["海底噴口附近而家仍然住住好奇怪嘅動物，例如巨型管蟲。佢哋靠噴口嘅化學物質生活，唔係靠陽光。","好長一段時間，藍綠菌製造嘅氧氣同海水入面嘅鐵起反應，令鐵生鏽沉底。之後氧氣先慢慢喺空氣入面積聚。呢個叫大氧化事件，大約發生喺24億年前。"]),
 dict(because="細細嘅改變喺一代又一代之間累積，新種類嘅動物就出現，連行得上陸地嘅都有。",
  prompts=["你諗到有乜嘢動物，身體好啱佢嘅生活環境呢？","點解要幾百萬年，而唔係一個人一生就夠呢？"],
  words=[["演化","生物一代又一代慢慢改變"],["一代","差唔多同期出生嘅一班，好似一個家庭入面嘅公公婆婆、爸爸媽媽同小朋友"],["三葉蟲","有硬殼嘅遠古海洋動物"]],
  known="大約5.4億年前，海洋出現有殼、有眼、有鰭嘅動物；之後大約3.75億年前，有啲動物行上陸地。", open="點解寒武紀有咁多新種類動物咁快出現。",
  more=["三葉蟲係節肢動物，同今日嘅蟹、昆蟲同蜘蛛係親戚。佢哋嘅眼睛由晶體鏡片組成，好多仲識得捲成一個波。","最早嘅陸地植物冇我哋今日睇到嗰種真正嘅根同葉。後來樹木演化出木質，嗰啲森林儲起咁多碳，仲幫手形成咗煤。"]),
 dict(because="一粒巨大嘅小行星改變咗世界，大型恐龍就絕種，而細隻嘅倖存者，即係鳥，就繼續生存。",
  prompts=["點解細隻嘅動物喺災難之後可能更容易生存？","你附近有邊啲鳥，可能係恐龍嘅親戚？"],
  words=[["小行星","喺太空飛行嘅石頭"],["絕種","永遠消失，一隻都冇剩"],["撞擊坑","被撞出嚟嘅碗形窿"]],
  known="大約6600萬年前，一粒闊度大約10公里（6英里）嘅小行星撞落墨西哥；鳥類係仲生存緊嘅恐龍。", open="其他事情，例如巨大嘅火山爆發，對恐龍滅絕有幾大影響。",
  more=["霸王龍生活喺恐龍時代尾，大約6800萬至6600萬年前。比起劍龍，佢同我哋喺時間上更加近。","撞擊坑而家埋喺墨西哥猶加敦海岸之下，就喺一個叫奇克蘇魯伯嘅小鎮附近。世界各地嘅岩石層入面，有一條薄薄嘅稀有金屬層，就係嗰粒小行星留低嘅。"]),
 dict(because="人類不斷學習同分享諗法，所以可以製造望遠鏡同火箭，探索太空。",
  prompts=["你覺得梯級入面邊個諗法最難發明？","你想人類下一步發現啲乜？需要啲乜嘢先做到？"],
  words=[["哺乳動物","有毛、會用奶餵細路嘅動物"],["望遠鏡","可以令遠處嘅嘢睇落近啲嘅工具"],["太空船","喺太空飛行嘅機器"]],
  known="現代人大約30萬年前出現；人類1961年第一次上太空，1969年登陸月球。", open="宇宙入面其他地方有冇生命。",
  more=["長毛象、披毛犀同劍齒虎生活喺最近一次冰河時期。人類仲將佢哋畫喺洞穴嘅牆上。","旅行者一號已經離開咗太陽附近，去咗星際空間。佢嘅無線電訊號要超過22個鐘頭先去到我哋度。"]),
]
for _y, _e in zip(Y, EXTRAS_Y): _y.update(_e)
_old_merge = merge
def merge(en, y):
    c = _old_merge(en, y)
    for k in ('because', 'prompts', 'words', 'known', 'open'): c[k] = y[k]
    for h, m in zip(c['hotspots'], y['more']): h['more'] = m
    return c
YUE = [merge(e, y) for e, y in zip(EN, Y)]

# ---- characters pilot (chapter 1 only) ----
_PILOT_Y = dict(asks=["吓？空間會脹大？點解㗎？", "第一批星係點樣出現㗎？"],
  gloss=dict(word="核聚變", ask="教授，核聚變係乜嘢嚟㗎？",
    answer="核聚變就係好細嘅原子被擠得好實，結合成一個大啲嘅原子，同時放出好多光同熱。恆星發光，就係靠核聚變，我哋嘅太陽都係咁。"))
for _h, _a in zip(YUE[0]['hotspots'], _PILOT_Y['asks']): _h['ask'] = _a
YUE[0]['gloss'] = _PILOT_Y['gloss']

# ---- characters rollout: chapters 2 to 6 ----
_CAST_Y = {
 1: (["太陽啱啱出現嘅時候係點樣㗎？", "月球係點嚟㗎？"],
     dict(word="忒伊亞", ask="教授，忒伊亞係邊個㗎？",
          answer="忒伊亞係科學家畀一個好似火星咁大嘅天體改嘅名。科學家認為佢撞過年輕嘅地球。當時冇人睇到，所以科學家用電腦模擬同月球石頭嚟驗證呢個諗法。")),
 2: (["咁深嘅海底，真係有嘢可以生存咩？", "啲氧氣係邊個造出嚟㗎？"],
     dict(word="氧氣", ask="教授，氧氣係乜嘢嚟㗎？",
          answer="氧氣係空氣入面嘅一種氣體。你同大部分動物都要靠佢呼吸。早在有動物之前，細小嘅細胞已經製造氧氣。")),
 3: (["三葉蟲係乜嘢嚟㗎？", "光禿禿嘅陸地係點樣變綠㗎？"],
     dict(word="演化", ask="教授，演化係咩意思㗎？",
          answer="演化即係生物一代又一代慢慢改變。呢啲改變發生喺成個家族身上，要幾百萬年，唔係一隻動物一生之內。")),
 4: (["霸王龍係咪恐龍之王㗎？", "嗰粒大大粒嘅小行星撞咗去邊度㗎？"],
     dict(word="小行星", ask="教授，小行星係乜嘢嚟㗎？",
          answer="小行星係喺太空飛行嘅石頭。大部分都好細，但有啲好大。墨西哥有個巨大嘅撞擊坑，世界各地嘅岩石都有線索，顯示大約6600萬年前有一粒撞過地球。")),
 5: (["冰河時期有啲乜嘢動物㗎？", "人類係點樣去到太空㗎？"],
     dict(word="宇宙", ask="教授，宇宙係乜嘢嚟㗎？",
          answer="宇宙就係所有嘢：成個太空、每一粒星、每一個行星，仲有我哋。佢大約有138億年歷史。我哋已經知道好多，但仲有好多嘢未知。")),
}
for _i, (_asks, _g) in _CAST_Y.items():
    for _h, _a in zip(YUE[_i]['hotspots'], _asks): _h['ask'] = _a
    YUE[_i]['gloss'] = _g

for _c, _a in zip(YUE, ["中間嗰粒細細嘅點係乜嚟㗎？", "啱啱形成嘅地球係點樣㗎？", "啲海洋係點嚟㗎？", "嗰陣時嘅陸地係點樣㗎？", "恐龍嗰陣時嘅陸地係點樣㗎？", "呢個係邊個星球㗎？"]):
    _c['centre']['ask'] = _a
