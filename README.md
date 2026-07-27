# 🌸 Gesture Bloom

> An interactive flower that blooms when you pinch your fingers — built with pure JavaScript + MediaPipe Hands.

![Gesture Bloom](https://img.shields.io/badge/MediaPipe-Hands-a855f7?style=flat-square&logo=google)
![JavaScript](https://img.shields.io/badge/JavaScript-Canvas-fbbf24?style=flat-square&logo=javascript)
![License](https://img.shields.io/badge/License-MIT-4ade80?style=flat-square)

---

## ✨ Demo

Hold your hand up to the camera, pinch your **thumb & index finger** together, then slowly open them to watch the flower bloom!

## 🚀 How It Works

| Gesture | Effect |
|---|---|
| Pinch close 🤏 | Flower stays budded |
| Open pinch 🖐 | Flower gradually blooms |
| Fully open | Burst of sparkle particles 🎉 |
| No hand detected | Flower slowly closes |

## 🛠 Tech Stack

- **HTML5 Canvas** — multi-layer flower rendering with bezier curves
- **MediaPipe Hands** — real-time thumb-to-index-finger pinch distance tracking
- **Vanilla JavaScript** — zero frameworks, zero build tools
- **CSS Glassmorphism** — dark premium UI design

## 📦 Run Locally

```bash
# Clone the repo
git clone https://github.com/albin669-gif/Gesture-bloom.git
cd Gesture-bloom

# Serve with Node (no install needed)
node -e "const http=require('http'),fs=require('fs'),path=require('path');const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript'};http.createServer((req,res)=>{const fp=path.join(__dirname,req.url==='/'?'index.html':req.url.slice(1));try{const d=fs.readFileSync(fp);res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'text/plain'});res.end(d)}catch(e){res.writeHead(404);res.end('Not found')}}).listen(5500,()=>console.log('Open http://localhost:5500'))"
```

Then open  https://albin669-gif.github.io/Gesture-bloom/ in your browser.

> **No camera?** Drag left/right on the flower canvas to bloom it manually!

## 📁 Structure

```
Gesture-bloom/
├── index.html   # App structure & MediaPipe CDN
├── style.css    # Glassmorphism dark UI design system
├── app.js       # Flower renderer + MediaPipe + particles
└── README.md
```

## 🎨 Features

- 🌺 **3-layer organic flower** — 8 outer + 6 mid + 5 inner petals, drawn with bezier curves
- ✨ **Particle system** — hearts, stars & circles burst at full bloom
- 📹 **Live hand skeleton preview** — see your hand landmarks in the corner
- 🌱 **Animated stem & leaves** — gently sway with the bloom
- 🖱 **Mouse drag fallback** — works without camera
- 📱 **2-finger pinch fallback** — works on touchscreens

## 📄 License

MIT © [albin669-gif](https://github.com/albin669-gif)
