# Group Wordle - Vite + React

A collaborative word game built with React and Vite, deployed on Netlify.

## 🎯 Project Structure

```
grordle/
├── index.html              # Minimal Vite entry point
├── index.html.backup       # Original monolithic file (for reference)
├── package.json            # Dependencies and scripts
├── vite.config.js          # Vite configuration
├── netlify.toml            # Netlify deployment config
├── netlify/functions/      # Serverless backend functions
│   ├── config.js
│   ├── start.js
│   ├── status.js
│   └── submit.js
└── src/
    ├── main.jsx            # React entry point
    ├── App.jsx             # Main application component
    ├── constants/
    │   └── gameConstants.js    # Game configuration constants
    ├── utils/
    │   ├── apiClient.js        # API fetch wrapper
    │   ├── dateUtils.js        # Australian date utilities
    │   └── wordUtils.js        # Word validation and scoring
    ├── hooks/
    │   ├── useWordList.js      # Dictionary loading hook
    │   ├── useMemberStartWords.js  # Member start words management
    │   └── useScores.js        # Score tracking and leaderboard
    ├── components/
    │   ├── TabButton.jsx       # Navigation tab button
    │   ├── GameBoard.jsx       # Main game interface
    │   ├── GuessRow.jsx        # Individual guess row with tiles
    │   ├── Keyboard.jsx        # On-screen keyboard
    │   ├── TodayResults.jsx    # Today's scores view
    │   ├── Leaderboard.jsx     # All-time leaderboard
    │   └── AdminPanel.jsx      # Admin configuration panel
    └── styles/
        └── animations.css      # Wordle-style tile animations
```

## 🚀 Development

### Prerequisites
- Node.js 20+
- npm

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```

The app will open at http://localhost:3000

### Build for Production
```bash
npm run build
```

Output will be in the `dist/` folder.

### Preview Production Build
```bash
npm run preview
```

## 📦 Key Technologies

- **React 18** - UI framework
- **Vite 5** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS (via CDN)
- **Netlify Functions** - Serverless backend
- **PostgreSQL** - Database (via Netlify Functions)

## 🎮 Features

- Daily word puzzles with Australian Eastern Time (AEST) timezone
- Member-specific starting words
- Wordle-style flip animations and keyboard tracking
- Persistent scores and leaderboards
- Admin panel for managing start words
- One play per person per day

## 🌐 Deployment

This app is configured for Netlify deployment:

1. Push to your connected Git repository
2. Netlify will automatically:
   - Run `npm run build`
   - Deploy the `dist/` folder
   - Set up serverless functions from `netlify/functions/`

## 📝 Environment Variables

Configure in Netlify dashboard or `.env`:
- `DATABASE_URL` - PostgreSQL connection string (for Netlify Functions)

## 🔧 Customization

### Change Starting Words
Use the Admin panel (password: `admin123`) to manage member start words.

### Modify Game Constants
Edit `src/constants/gameConstants.js`:
- `FLIP_DURATION` - Animation speed
- `FLIP_STAGGER` - Delay between tile reveals
- `KEYBOARD_ROWS` - Keyboard layout

### Change Word List
The app uses the Wordle word list from GitHub. To use a different list, update `WORDLIST_URL` in `gameConstants.js`.

## 📄 License

Private project

## 🙏 Acknowledgments

- Word list from [tabatkins/wordle-list](https://github.com/tabatkins/wordle-list)
- Inspired by the original Wordle game
