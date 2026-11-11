// Les textes de la vue Jeux : l'angle arménien de chaque jeu, puis ses règles
// en court, dans les sept langues.
//
// Module PLAT (pas de JSX) : test/games-texts.test.mjs doit le lire depuis
// Node. Même raison que src/stations.js, src/seo.js, src/site.js.
//
// LA RÈGLE, la même que src/stations.js : aucun fait sans source `https://`,
// et un fait introuvable, ou sur lequel deux sources se contredisent, est
// OMIS — jamais approché. Chaque paragraphe d'intro déclare dans `facts` les
// faits qu'il affirme (identiques d'une langue à l'autre) ; un paragraphe qui
// n'en affirme aucun porte `facts: []`. Les `facts` sont des données, jamais
// du texte affiché.
//
// Le backgammon proposé est le backgammon OCCIDENTAL (avec videau). Le texte
// peut dire qu'en Arménie on joue aussi le long nardi, sans laisser croire
// que c'est celui-là.
//
// Les noms propres s'écrivent dans l'écriture de la page : pas de latin dans
// `hy` ni `ru` (le test en tolère moins de 10 %).
//
// Ordre de GAMES = ordre d'affichage.

export const GAMES = [
  {
    id: 'echecs',
    path: '/play/echecs/',
    facts: [
      {
        // « Since the 2011–12 school year » (Wikipédia) ; « The plan took
        // effect beginning with the current academic year », article du
        // 19 septembre 2011 (RFE/RL). D'où « depuis la rentrée 2011 ».
        id: 'ecole-2011',
        sources: [
          'https://en.wikipedia.org/wiki/Chess_in_Armenia',
          'https://www.rferl.org/a/armenia_introduces_chess_as_mandatory_school_subject/24333249.html',
        ],
      },
      {
        id: 'olympiades',
        sources: [
          'https://en.wikipedia.org/wiki/40th_Chess_Olympiad',
          'https://en.wikipedia.org/wiki/Chess_in_Armenia',
        ],
      },
      {
        id: 'petrossian',
        sources: [
          'https://en.wikipedia.org/wiki/Tigran_Petrosian',
          'https://en.wikipedia.org/wiki/Chess_in_Armenia',
        ],
      },
    ],
    text: {
      fr: {
        title: 'Échecs',
        intro: [
          {
            text: "En Arménie, les échecs s'apprennent à l'école : depuis la rentrée 2011, ils y sont une matière obligatoire.",
            facts: ['ecole-2011'],
          },
          {
            text: "L'équipe d'Arménie a remporté l'Olympiade d'échecs en 2006, en 2008 et en 2012.",
            facts: ['olympiades'],
          },
          {
            text: 'Tigran Petrossian a été champion du monde de 1963 à 1969.',
            facts: ['petrossian'],
          },
        ],
        rules: [
          'Les blancs jouent en premier, puis chaque joueur joue un coup à son tour.',
          'Chaque pièce a sa marche : le fou en diagonale, la tour en ligne droite, la dame dans les deux, le cavalier en L.',
          'On prend une pièce adverse en occupant sa case.',
          "Un roi attaqué est en échec, et son joueur doit le mettre à l'abri au coup suivant.",
          "La partie se gagne par échec et mat : le roi adverse est en échec et ne peut plus s'en sortir.",
        ],
      },
      de: {
        title: 'Schach',
        intro: [
          {
            text: 'In Armenien lernt man Schach in der Schule: Seit dem Schuljahr 2011 ist es dort Pflichtfach.',
            facts: ['ecole-2011'],
          },
          {
            text: 'Die armenische Mannschaft hat die Schacholympiade 2006, 2008 und 2012 gewonnen.',
            facts: ['olympiades'],
          },
          {
            text: 'Tigran Petrosjan war von 1963 bis 1969 Schachweltmeister.',
            facts: ['petrossian'],
          },
        ],
        rules: [
          'Weiß zieht zuerst, danach ziehen die Spieler abwechselnd je einen Zug.',
          'Jede Figur hat ihre Gangart: der Läufer diagonal, der Turm gerade, die Dame beides, der Springer im L.',
          'Man schlägt eine gegnerische Figur, indem man ihr Feld besetzt.',
          'Ein angegriffener König steht im Schach, und sein Spieler muss ihn mit dem nächsten Zug in Sicherheit bringen.',
          'Die Partie gewinnt man durch Schachmatt: Der gegnerische König steht im Schach und kann ihm nicht mehr entkommen.',
        ],
      },
      it: {
        title: 'Scacchi',
        intro: [
          {
            text: "In Armenia gli scacchi si imparano a scuola: dall'anno scolastico 2011 vi sono materia obbligatoria.",
            facts: ['ecole-2011'],
          },
          {
            text: 'La squadra armena ha vinto le Olimpiadi degli scacchi nel 2006, nel 2008 e nel 2012.',
            facts: ['olympiades'],
          },
          {
            text: 'Tigran Petrosian è stato campione del mondo dal 1963 al 1969.',
            facts: ['petrossian'],
          },
        ],
        rules: [
          'Il Bianco muove per primo, poi i giocatori muovono a turno, una mossa ciascuno.',
          "Ogni pezzo ha il suo movimento: l'alfiere in diagonale, la torre in linea retta, la donna in entrambi i modi, il cavallo a L.",
          'Si cattura un pezzo avversario occupando la sua casa.',
          'Un re attaccato è sotto scacco, e il suo giocatore deve metterlo al sicuro alla mossa successiva.',
          "Si vince con lo scacco matto: il re avversario è sotto scacco e non ha più via d'uscita.",
        ],
      },
      en: {
        title: 'Chess',
        intro: [
          {
            text: 'In Armenia, chess is learned at school: since the 2011 school year, it has been a compulsory subject.',
            facts: ['ecole-2011'],
          },
          {
            text: "Armenia's team won the Chess Olympiad in 2006, 2008 and 2012.",
            facts: ['olympiades'],
          },
          {
            text: 'Tigran Petrosian was world chess champion from 1963 to 1969.',
            facts: ['petrossian'],
          },
        ],
        rules: [
          'White moves first, then the players take turns, one move each.',
          'Each piece has its own move: the bishop diagonally, the rook in straight lines, the queen both ways, the knight in an L.',
          "You capture an opponent's piece by moving onto its square.",
          'A king under attack is in check, and its player must get it to safety on the next move.',
          'The game is won by checkmate: the opposing king is in check and has no way out.',
        ],
      },
      es: {
        title: 'Ajedrez',
        intro: [
          {
            text: 'En Armenia, el ajedrez se aprende en la escuela: desde el curso 2011 es una asignatura obligatoria.',
            facts: ['ecole-2011'],
          },
          {
            text: 'El equipo de Armenia ganó la Olimpiada de Ajedrez en 2006, 2008 y 2012.',
            facts: ['olympiades'],
          },
          {
            text: 'Tigran Petrosian fue campeón mundial de ajedrez de 1963 a 1969.',
            facts: ['petrossian'],
          },
        ],
        rules: [
          'Las blancas mueven primero; después los jugadores mueven por turnos, una jugada cada uno.',
          'Cada pieza tiene su movimiento: el alfil en diagonal, la torre en línea recta, la dama de ambas formas, el caballo en L.',
          'Se captura una pieza rival ocupando su casilla.',
          'Un rey atacado está en jaque, y su jugador debe ponerlo a salvo en la jugada siguiente.',
          'Se gana con jaque mate: el rey rival está en jaque y no tiene escapatoria.',
        ],
      },
      hy: {
        title: 'Շախմատ',
        intro: [
          {
            text: 'Հայաստանում շախմատ սովորում են դպրոցում։ 2011 թվականից այն պարտադիր առարկա է։',
            facts: ['ecole-2011'],
          },
          {
            text: 'Հայաստանի հավաքականը հաղթել է Շախմատային օլիմպիադայում 2006, 2008 և 2012 թվականներին։',
            facts: ['olympiades'],
          },
          {
            text: 'Տիգրան Պետրոսյանը շախմատի աշխարհի չեմպիոն էր 1963–1969 թվականներին։',
            facts: ['petrossian'],
          },
        ],
        rules: [
          'Առաջինը քայլում են սպիտակները, հետո խաղացողները քայլում են հերթով՝ մեկական քայլ։',
          'Փիղը քայլում է անկյունագծով, նավակը՝ ուղիղ գծով, թագուհին՝ երկու ձևով, իսկ ձին՝ երկու վանդակ ուղիղ և մեկը կողք։',
          'Հակառակորդի խաղաքարը վերցնում են՝ գրավելով նրա վանդակը։',
          'Հարձակման տակ գտնվող արքան շախի տակ է, և խաղացողը հաջորդ քայլով պետք է այն փրկի։',
          'Խաղը շահում է նա, ով մատ է տալիս՝ հակառակորդի արքան շախի տակ է և ելք չունի։',
        ],
      },
      ru: {
        title: 'Шахматы',
        intro: [
          {
            text: 'В Армении шахматам учат в школе: с 2011 года это обязательный предмет.',
            facts: ['ecole-2011'],
          },
          {
            text: 'Сборная Армении выигрывала Шахматную олимпиаду в 2006, 2008 и 2012 годах.',
            facts: ['olympiades'],
          },
          {
            text: 'Тигран Петросян был чемпионом мира по шахматам с 1963 по 1969 год.',
            facts: ['petrossian'],
          },
        ],
        rules: [
          'Первыми ходят белые, затем игроки ходят по очереди, по одному ходу.',
          'У каждой фигуры свой ход: слон — по диагонали, ладья — по прямой, ферзь — и так и так, конь — буквой «Г».',
          'Фигуру соперника берут, занимая её поле.',
          'Король под ударом находится под шахом, и игрок должен увести его из-под шаха следующим ходом.',
          'Партия выиграна матом: король соперника под шахом, и спастись ему некуда.',
        ],
      },
    },
  },
  {
    id: 'backgammon',
    path: '/play/backgammon/',
    facts: [
      {
        // Le mot lui-même : article « Նարդի » de Wikipédia en arménien (lié à
        // la catégorie Commons « Backgammon »), Global Voices (« Nardi- (or
        // backgammon-) playing seniors »), et la Fédération nationale de
        // nardi d'Arménie citée par Etchmiadzine.
        id: 'nardi',
        sources: [
          'https://hy.wikipedia.org/wiki/%D5%86%D5%A1%D6%80%D5%A4%D5%AB',
          'https://globalvoices.org/2007/07/11/armenia-playing-nardi/',
          'https://ejmiatsin.am/news/108/',
        ],
      },
      {
        // « in Yerevan's courtyards and parks, I had always seen grandpas deep
        // in games of chess, checkers and backgammon » (EVN Report).
        id: 'cours-parcs',
        sources: ['https://evnreport.com/lifestyle/salt-yerevans-board-game-subculture/'],
      },
      {
        // Wikipédia en arménien : le nardi court et le long nardi sont tous
        // deux très répandus en Arménie ; au long, toutes les dames partent
        // de la même case et on ne frappe pas.
        id: 'long-nardi',
        sources: ['https://hy.wikipedia.org/wiki/%D5%86%D5%A1%D6%80%D5%A4%D5%AB'],
      },
    ],
    text: {
      fr: {
        title: 'Backgammon',
        intro: [
          {
            text: "En Arménie, le backgammon s'appelle le nardi. On y joue dans les cours et les parcs d'Erevan.",
            facts: ['nardi', 'cours-parcs'],
          },
          {
            text: 'On joue aussi en Arménie le long nardi, aux règles différentes. Le jeu proposé ici est le backgammon occidental, avec son videau.',
            facts: ['long-nardi'],
          },
        ],
        rules: [
          'Chaque joueur fait avancer ses quinze pions dans un sens fixé, vers le dernier quart du plateau.',
          "On lance deux dés et on avance d'autant de cases ; un double se joue quatre fois.",
          "Un pion ne peut pas s'arrêter sur une case occupée par deux pions adverses ou plus.",
          'Un pion seul sur sa case peut être frappé : il part sur la barre et doit rentrer avant tout autre coup.',
          'Quand tous ses pions sont dans le dernier quart, on peut les sortir ; le premier qui a tout sorti gagne.',
          "Le videau double la mise : l'adversaire accepte, ou abandonne la partie.",
        ],
      },
      de: {
        title: 'Backgammon',
        intro: [
          {
            text: 'In Armenien heißt Backgammon Nardi. Man spielt es in den Höfen und Parks von Jerewan.',
            facts: ['nardi', 'cours-parcs'],
          },
          {
            text: 'In Armenien spielt man auch Lang-Nardi, mit anderen Regeln. Hier gespielt wird das westliche Backgammon, mit Doppelwürfel.',
            facts: ['long-nardi'],
          },
        ],
        rules: [
          'Jeder Spieler zieht seine fünfzehn Steine in einer festen Richtung, auf das letzte Viertel des Bretts zu.',
          'Man wirft zwei Würfel und zieht um die gewürfelten Augen; ein Pasch wird viermal gezogen.',
          'Ein Stein darf nicht auf einem Feld landen, auf dem zwei oder mehr gegnerische Steine stehen.',
          'Ein einzelner Stein kann geschlagen werden: Er kommt auf die Bar und muss vor jedem anderen Zug wieder eingesetzt werden.',
          'Stehen alle eigenen Steine im letzten Viertel, darf man sie hinauswürfeln; wer zuerst alle hinausgebracht hat, gewinnt.',
          'Der Doppelwürfel verdoppelt den Einsatz: Der Gegner nimmt an oder gibt die Partie auf.',
        ],
      },
      it: {
        title: 'Backgammon',
        intro: [
          {
            text: 'In Armenia il backgammon si chiama nardi. Si gioca nei cortili e nei parchi di Erevan.',
            facts: ['nardi', 'cours-parcs'],
          },
          {
            text: 'In Armenia si gioca anche il nardi lungo, con regole diverse. Il gioco proposto qui è il backgammon occidentale, con il cubo del raddoppio.',
            facts: ['long-nardi'],
          },
        ],
        rules: [
          "Ogni giocatore muove le sue quindici pedine in un senso fisso, verso l'ultimo quarto del tavoliere.",
          'Si lanciano due dadi e si avanza di altrettante punte; un doppio si gioca quattro volte.',
          'Una pedina non può fermarsi su una punta occupata da due o più pedine avversarie.',
          'Una pedina sola può essere colpita: va sulla barra e deve rientrare prima di ogni altra mossa.',
          "Quando tutte le proprie pedine sono nell'ultimo quarto, si possono portare fuori; vince chi le porta fuori tutte per primo.",
          "Il cubo del raddoppio raddoppia la posta: l'avversario accetta o abbandona la partita.",
        ],
      },
      en: {
        title: 'Backgammon',
        intro: [
          {
            text: 'In Armenia, backgammon is called nardi. It is played in the courtyards and parks of Yerevan.',
            facts: ['nardi', 'cours-parcs'],
          },
          {
            text: 'Long nardi, with different rules, is also played in Armenia. The game offered here is Western backgammon, with the doubling cube.',
            facts: ['long-nardi'],
          },
        ],
        rules: [
          'Each player moves fifteen checkers in a fixed direction, towards the last quarter of the board.',
          'You roll two dice and move that many points; a double is played four times.',
          'A checker cannot land on a point held by two or more opposing checkers.',
          'A lone checker can be hit: it goes to the bar and must re-enter before any other move.',
          'Once all your checkers are in the last quarter, you can bear them off; the first to bear them all off wins.',
          'The doubling cube doubles the stakes: the opponent accepts or concedes the game.',
        ],
      },
      es: {
        title: 'Backgammon',
        intro: [
          {
            text: 'En Armenia, el backgammon se llama nardi. Se juega en los patios y parques de Ereván.',
            facts: ['nardi', 'cours-parcs'],
          },
          {
            text: 'En Armenia también se juega el nardi largo, con otras reglas. El juego que se ofrece aquí es el backgammon occidental, con el cubo de doblaje.',
            facts: ['long-nardi'],
          },
        ],
        rules: [
          'Cada jugador mueve sus quince fichas en un sentido fijo, hacia el último cuarto del tablero.',
          'Se tiran dos dados y se avanza ese número de puntas; un doble se juega cuatro veces.',
          'Una ficha no puede detenerse en una punta ocupada por dos o más fichas rivales.',
          'Una ficha sola puede ser golpeada: va a la barra y debe volver a entrar antes de cualquier otra jugada.',
          'Cuando todas las fichas propias están en el último cuarto, se pueden sacar; gana quien las saca todas primero.',
          'El cubo de doblaje duplica la apuesta: el rival acepta o abandona la partida.',
        ],
      },
      hy: {
        title: 'Բեքգեմոն',
        intro: [
          {
            text: 'Հայաստանում բեքգեմոնը կոչվում է նարդի։ Այն խաղում են Երևանի բակերում և այգիներում։',
            facts: ['nardi', 'cours-parcs'],
          },
          {
            text: 'Հայաստանում խաղում են նաև երկար նարդի՝ այլ կանոններով։ Այստեղ առաջարկվում է արևմտյան բեքգեմոնը՝ կրկնապատկման խորանարդով։',
            facts: ['long-nardi'],
          },
        ],
        rules: [
          'Յուրաքանչյուր խաղացող իր տասնհինգ քարերը տանում է մեկ ուղղությամբ՝ դեպի տախտակի վերջին քառորդը։',
          'Գցում են երկու զառ և քարերը տանում են այդքան դաշտ առաջ, իսկ զույգը խաղում են չորս անգամ։',
          'Քարը չի կարող կանգնել այն դաշտում, որտեղ հակառակորդի երկու կամ ավելի քար կա։',
          'Միայնակ քարը կարելի է խփել, և այն պետք է նորից մտնի խաղ ամեն այլ քայլից առաջ։',
          'Երբ բոլոր քարերը վերջին քառորդում են, կարելի է դրանք հանել տախտակից, և հաղթում է նա, ով առաջինը հանում է բոլորը։',
          'Կրկնապատկման խորանարդը կրկնապատկում է խաղադրույքը, և հակառակորդը կա՛մ ընդունում է, կա՛մ հանձնվում։',
        ],
      },
      ru: {
        title: 'Бэкгаммон',
        intro: [
          {
            text: 'В Армении бэкгаммон называют «нарди». В него играют во дворах и парках Еревана.',
            facts: ['nardi', 'cours-parcs'],
          },
          {
            text: 'В Армении играют и в длинные нарды, по другим правилам. Здесь предлагается западный бэкгаммон, с кубом удвоения.',
            facts: ['long-nardi'],
          },
        ],
        rules: [
          'Каждый игрок ведёт свои пятнадцать шашек в одном направлении, к последней четверти доски.',
          'Бросают два кубика и проходят столько же пунктов; дубль играется четыре раза.',
          'Шашка не может встать на пункт, где стоят две или больше шашки соперника.',
          'Одиночную шашку можно побить: она уходит на бар и должна вернуться в игру прежде любого другого хода.',
          'Когда все свои шашки в последней четверти, их можно выводить с доски; побеждает тот, кто первым вывел все.',
          'Куб удвоения удваивает ставку: соперник принимает её или сдаёт партию.',
        ],
      },
    },
  },
]
