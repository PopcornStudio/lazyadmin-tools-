# Ubuntu Telegram Shell
# Ubuntu Telegram Shell  
**Full Ubuntu/Linux terminal inside Telegram — control your server from your phone**

Run any command instantly  
Clean & beautiful colored output  
`sudo` passwords automatically hidden  
Zero ANSI garbage · Clear screen handled · Live editing

### Features
- Real interactive Bash (256 colors)  
- Perfectly clean output in Telegram  
- `sudo` password masked as ••••••••  
- Clear screen → "--- Screen cleared ---"  
- Huge output auto-split & live-edited  
- Locked to your Telegram ID only (super secure)  
- Lightweight · no bloat · runs anywhere

### Setup

```bash
# Clone
git clone https://github.com/PopcornStudio/Ubuntu-Telegram-Shell.git
cd Ubuntu-Telegram-Shell

# Install
npm install

# Create .env
cat > .env <<EOF
TELEGRAM_TOKEN=your_bot_token_here
ALLOWED_USER_ID=your_telegram_id_here
EOF

# Run
node Ubuntu-Telegram-Shell.js
