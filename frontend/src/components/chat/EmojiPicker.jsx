// src/components/chat/EmojiPicker.jsx
import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';

// Emojis organisés par catégories
const EMOJI_CATEGORIES = [
  {
    id: 'recent', label: '🕐', title: 'Récents',
    emojis: ['😀','😂','❤️','👍','🙏','😊','🔥','🎉','👏','😍','🤔','😢'],
  },
  {
    id: 'smileys', label: '😀', title: 'Smileys',
    emojis: [
      '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃',
      '😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜',
      '🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔',
      '😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤',
      '😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓',
      '🤗','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧',
      '😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧',
      '😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻',
      '💀','☠️','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽',
    ],
  },
  {
    id: 'gestures', label: '👋', title: 'Gestes & Corps',
    emojis: [
      '👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘',
      '🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛',
      '🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪',
      '🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁',
      '👅','👄','💋','🩸',
    ],
  },
  {
    id: 'hearts', label: '❤️', title: 'Cœurs & Symboles',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕',
      '💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','☸️',
      '✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌',
      '♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️',
      '📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️',
      '㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘',
      '❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳',
      '🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆',
      '🔱','⚜️','🔰','♻️','✅','🈯','💹','❇️','✳️','❎','🌐','💠',
      'Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗','🈳','🈂️','🛂','🛃',
      '🛄','🛅','🚹','🚺','🚼','⚧','🚻','🚮','🎦','📶','🈁','🔣',
      'ℹ️','🔤','🔡','🔠','🆖','🆗','🆙','🆒','🆕','🆓','0️⃣','1️⃣',
    ],
  },
  {
    id: 'nature', label: '🌿', title: 'Nature',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁',
      '🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤',
      '🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋',
      '🐌','🐞','🐜','🪲','🦟','🦗','🪳','🕷','🕸','🦂','🐢','🐍',
      '🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬',
      '🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛',
      '🌸','🌺','🌻','🌹','🌷','🌼','💐','🌾','🍀','🌿','🍃','🍂',
      '🍁','🍄','🌰','🦔','🐾','🌵','🎋','🎍','🌱','🌲','🌳','🌴',
    ],
  },
  {
    id: 'food', label: '🍕', title: 'Nourriture',
    emojis: [
      '🍎','🍊','🍋','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥',
      '🥝','🍅','🍆','🥑','🫛','🥦','🥬','🥒','🌶','🫑','🧄','🧅',
      '🥔','🍠','🫚','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈',
      '🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔','🍟','🍕','🫓',
      '🌮','🌯','🫔','🥙','🧆','🥚','🍳','🥘','🫕','🍲','🫙','🥣',
      '🥗','🍿','🧂','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠',
      '🍢','🍣','🍤','🍥','🥮','🍡','🥟','🦪','🍦','🍧','🍨','🍩',
      '🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','🥛',
      '☕','🫖','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃',
    ],
  },
  {
    id: 'travel', label: '✈️', title: 'Voyage & Lieux',
    emojis: [
      '🚗','🚕','🚙','🚌','🚎','🏎','🚓','🚑','🚒','🚐','🛻','🚚',
      '🚛','🚜','🏍','🛵','🛺','🚲','🛴','🛹','🛼','🚏','🛣','🛤',
      '⛽','🛞','🚨','🚥','🚦','🛑','🚧','⚓','🛟','⛵','🛶','🚤',
      '🛳','⛴','🛥','🚢','✈️','🛩','🛫','🛬','🪂','💺','🚁','🚟',
      '🚠','🚡','🛰','🚀','🛸','🪐','🌍','🌎','🌏','🧭','🏔','⛰',
      '🌋','🗻','🏕','🏖','🏜','🏝','🏞','🏟','🏛','🏗','🧱','🪨',
      '🪵','🛖','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪',
      '🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍',
    ],
  },
  {
    id: 'objects', label: '💡', title: 'Objets',
    emojis: [
      '⌚','📱','📲','💻','⌨️','🖥','🖨','🖱','🖲','💾','💿','📀',
      '🧮','📷','📸','📹','🎥','📽','🎞','📞','☎️','📟','📠','📺',
      '📻','🧭','⏱','⏲','⏰','🕰','⌛','📡','🔋','🪫','🔌','💡',
      '🔦','🕯','🪔','🧯','🛢','💸','💵','💴','💶','💷','🪙','💰',
      '💳','💎','⚖️','🪜','🧰','🔧','🔨','⚒','🛠','⛏','🔩','🪤',
      '🧲','🔫','💣','🧨','🪓','🔪','🗡','⚔️','🛡','🪚','🔒','🔓',
      '🔏','🔐','🔑','🗝','🚪','🪑','🛋','🛏','🛁','🚿','🪠','🧴',
      '🧷','🧹','🧺','🧻','🪣','🧼','🫧','🪥','🧽','🧯','🛒','🚽',
    ],
  },
  {
    id: 'flags', label: '🚩', title: 'Drapeaux & Activités',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸',
      '🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🎣','🤿','🎽','🎿',
      '🛷','🥌','🎯','🪀','🪆','🎮','🎲','🧩','🃏','🀄','🎴','🎭',
      '🎨','🖼','🎪','🎠','🎡','🎢','🎪','🎤','🎧','🎼','🎵','🎶',
      '🎷','🪗','🎸','🎹','🎺','🎻','🥁','🪘','🎙','🎚','🎛','📻',
      '🏆','🥇','🥈','🥉','🏅','🎖','🏵','🎗','🎫','🎟','🎪','🤹',
      '🎭','🎨','🎬','🎤','🎧','🎼','🎵','🎶','🎻','🎷','🎺','🥁',
      '🎹','🪇','🪈','🎸','🪗','🪘','🎙','📯','🔔','🔕','🎵','🎶',
    ],
  },
];

export default function EmojiPickerPanel({ onSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState('recent');
  const [search, setSearch] = useState('');
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    searchRef.current?.focus();
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Recherche dans tous les emojis
  const searchResults = search
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((_, i) => {
        // Simple: filtrer par index pour la démo
        return true;
      }).slice(0, 40)
    : null;

  const currentCategory = EMOJI_CATEGORIES.find((c) => c.id === activeCategory);
  const displayEmojis = search
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).slice(0, 60)
    : currentCategory?.emojis || [];

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full mb-2 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 w-80 overflow-hidden"
    >
      {/* Barre de recherche */}
      <div className="p-3 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            ref={searchRef}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400"
            placeholder="Rechercher un emoji..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Onglets catégories */}
      {!search && (
        <div className="flex items-center gap-0 px-2 py-1.5 border-b border-slate-100 overflow-x-auto no-scrollbar">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              title={cat.title}
              className={`flex-shrink-0 w-8 h-8 rounded-lg text-base flex items-center justify-center transition-colors
                ${activeCategory === cat.id ? 'bg-primary-100' : 'hover:bg-slate-100'}`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Titre catégorie */}
      {!search && (
        <div className="px-3 py-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            {currentCategory?.title}
          </span>
        </div>
      )}

      {/* Grille emojis */}
      <div className="h-48 overflow-y-auto px-2 pb-2">
        <div className="grid grid-cols-8 gap-0.5">
          {displayEmojis.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              onClick={() => onSelect(emoji)}
              className="w-9 h-9 flex items-center justify-center text-xl rounded-lg hover:bg-primary-50 transition-colors"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
