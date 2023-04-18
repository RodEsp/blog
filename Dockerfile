FROM node:lts AS build
ENV NODE_ENV=dev

WORKDIR /build
COPY . .

RUN npm install
RUN npm run build

FROM node:lts-alpine
ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
COPY .eleventy.js ./
COPY .eleventyignore ./
COPY --from=build /build/_site ./_site

RUN npm ci --omit=dev

EXPOSE 80
ENTRYPOINT [ "npm", "start" ]