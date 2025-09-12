# Vocab Swipe (React + Vite + Tailwind)

## Chạy local
```bash
npm install
npm run dev
# mở http://localhost:5173
```

## Build
```bash
npm run build
# output ở ./dist
```

## Docker (tùy chọn)
```bash
docker build -t vocab-swipe .
docker run -p 8080:80 vocab-swipe
# mở http://localhost:8080
```

## Deploy lên Koyeb
- Push repo này lên GitHub/GitLab.
- Vào https://app.koyeb.com -> Create App -> chọn repo -> Koyeb tự đọc Dockerfile.
- Giữ port 80 (Nginx). Deploy là chạy.
```

Nguồn dữ liệu: Datamuse, dictionaryapi.dev, MyMemory Translate.
