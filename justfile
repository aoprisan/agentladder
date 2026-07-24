# Agentic guide — https://github.com/casey/just

default: dev

install:
    npm install

dev: install
    npx vite

build: install
    npx tsc && npx vite build

preview: build
    npx vite preview

# deploy dist/ to the gh-pages branch
deploy: build
    npx gh-pages -d dist
