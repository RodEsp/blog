FROM node:lts AS build
ENV NODE_ENV=dev

WORKDIR /build
COPY . .

RUN npm install

FROM node:lts-alpine
ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --production
COPY --from=build /build/ ./

EXPOSE 80
ENTRYPOINT [ "npm", "start" ]