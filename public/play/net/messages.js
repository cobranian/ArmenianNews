// Messages d'erreur des salles, montrés tels quels par les jeux. La langue est
// celle que le jeu a posée sur <html lang> (voir le dictionnaire de chaque jeu).
// Module à part, avec sa propre URL : un onglet ancien qui garde en cache
// l'ancien salle.js n'y trouverait pas un nouveau nom exporté.

const MESSAGES = {
  creation: {
    fr: 'Impossible de créer une salle. Réessaie dans un instant.',
    en: "Couldn't create a room. Try again in a moment.",
    es: 'No se pudo crear la sala. Inténtalo de nuevo en un momento.',
    de: 'Raum konnte nicht erstellt werden. Versuch es gleich noch einmal.',
    pt: 'Não foi possível criar a sala. Tente de novo daqui a pouco.',
    it: 'Impossibile creare una stanza. Riprova tra un attimo.',
    ru: 'Не удалось создать комнату. Попробуй ещё раз чуть позже.',
    zh: '无法创建房间，请稍后再试。',
    ar: 'تعذّر إنشاء الغرفة. حاول مجددًا بعد لحظات.',
    bn: 'ঘর তৈরি করা গেল না। একটু পরে আবার চেষ্টা করো।',
    hy: 'Չհաջողվեց սենյակ ստեղծել։ Մի քիչ հետո նորից փորձիր։',
    ur: 'کمرہ نہیں بن سکا۔ تھوڑی دیر بعد دوبارہ کوشش کریں۔',
  },
  invalide: {
    fr: 'Code de salle invalide.',
    en: 'Invalid room code.',
    es: 'Código de sala no válido.',
    de: 'Ungültiger Raumcode.',
    pt: 'Código de sala inválido.',
    it: 'Codice della stanza non valido.',
    ru: 'Неверный код комнаты.',
    zh: '房间代码无效。',
    ar: 'رمز الغرفة غير صالح.',
    bn: 'ঘরের কোডটি সঠিক নয়।',
    hy: 'Սենյակի կոդը սխալ է։',
    ur: 'کمرے کا کوڈ درست نہیں۔',
  },
  absente: {
    fr: "Cette salle n'existe pas ou a expiré.",
    en: "This room doesn't exist or has expired.",
    es: 'Esta sala no existe o ha caducado.',
    de: 'Diesen Raum gibt es nicht oder er ist abgelaufen.',
    pt: 'Esta sala não existe ou expirou.',
    it: 'Questa stanza non esiste o è scaduta.',
    ru: 'Этой комнаты нет или срок её действия истёк.',
    zh: '该房间不存在或已过期。',
    ar: 'هذه الغرفة غير موجودة أو انتهت صلاحيتها.',
    bn: 'এই ঘরটি নেই, অথবা এর মেয়াদ শেষ হয়ে গেছে।',
    hy: 'Այս սենյակը գոյություն չունի կամ ժամկետն անցել է։',
    ur: 'یہ کمرہ موجود نہیں یا اس کی مدت ختم ہو چکی ہے۔',
  },
  absenteOuPleine: {
    fr: "Cette salle n'existe pas, a expiré ou est déjà pleine.",
    en: "This room doesn't exist, has expired or is already full.",
    es: 'Esta sala no existe, ha caducado o ya está llena.',
    de: 'Diesen Raum gibt es nicht, er ist abgelaufen oder schon voll.',
    pt: 'Esta sala não existe, expirou ou já está cheia.',
    it: 'Questa stanza non esiste, è scaduta o è già piena.',
    ru: 'Этой комнаты нет, срок её действия истёк или она уже заполнена.',
    zh: '该房间不存在、已过期或已满。',
    ar: 'هذه الغرفة غير موجودة أو انتهت صلاحيتها أو ممتلئة بالفعل.',
    bn: 'এই ঘরটি নেই, এর মেয়াদ শেষ, অথবা এটি ইতিমধ্যে ভরা।',
    hy: 'Այս սենյակը գոյություն չունի, ժամկետն անցել է կամ արդեն լիքն է։',
    ur: 'یہ کمرہ موجود نہیں، اس کی مدت ختم ہو چکی ہے یا یہ پہلے ہی بھرا ہوا ہے۔',
  },
  ancienne: {
    fr: 'Cette partie a été créée avec une ancienne version du jeu. Crée une nouvelle partie.',
    en: 'This game was created with an older version. Start a new game.',
    es: 'Esta partida se creó con una versión antigua del juego. Crea una partida nueva.',
    de: 'Diese Partie stammt aus einer älteren Spielversion. Starte eine neue Partie.',
    pt: 'Esta partida foi criada com uma versão antiga do jogo. Crie uma nova partida.',
    it: 'Questa partita è stata creata con una versione precedente del gioco. Crea una nuova partita.',
    ru: 'Эта партия создана в старой версии игры. Создай новую партию.',
    zh: '这局游戏是用旧版本创建的，请新开一局。',
    ar: 'أُنشئت هذه المباراة بإصدار قديم من اللعبة. أنشئ مباراة جديدة.',
    bn: 'এই খেলাটি খেলার পুরোনো সংস্করণে তৈরি। নতুন খেলা শুরু করো।',
    hy: 'Այս խաղը ստեղծվել է հին տարբերակով։ Նոր խաղ սկսիր։',
    ur: 'یہ مقابلہ کھیل کے پرانے ورژن میں بنایا گیا تھا۔ نیا مقابلہ شروع کریں۔',
  },
  pleine: {
    fr: 'Cette salle est déjà pleine.',
    en: 'This room is already full.',
    es: 'Esta sala ya está llena.',
    de: 'Dieser Raum ist schon voll.',
    pt: 'Esta sala já está cheia.',
    it: 'Questa stanza è già piena.',
    ru: 'Эта комната уже заполнена.',
    zh: '该房间已满。',
    ar: 'هذه الغرفة ممتلئة بالفعل.',
    bn: 'এই ঘরটি ইতিমধ্যে ভরা।',
    hy: 'Այս սենյակն արդեն լիքն է։',
    ur: 'یہ کمرہ پہلے ہی بھرا ہوا ہے۔',
  },
  action: {
    fr: 'Action non enregistrée.',
    en: "Your move wasn't saved.",
    es: 'La jugada no se guardó.',
    de: 'Der Zug wurde nicht gespeichert.',
    pt: 'A jogada não foi salva.',
    it: 'La mossa non è stata salvata.',
    ru: 'Ход не сохранён.',
    zh: '操作未能保存。',
    ar: 'لم تُحفظ الحركة.',
    bn: 'চালটি সংরক্ষিত হয়নি।',
    hy: 'Քայլը չպահպանվեց։',
    ur: 'چال محفوظ نہیں ہوئی۔',
  },
};

export function langueCourante() {
  const l = (typeof document !== 'undefined' && document.documentElement.lang) || 'fr';
  return l.toLowerCase().split('-')[0];
}

export function message(cle) {
  const m = MESSAGES[cle];
  return m[langueCourante()] || m.fr;
}
