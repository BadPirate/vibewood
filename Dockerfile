# syntax=docker/dockerfile:1

ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

ENV NODE_ENV=development

COPY package.json package-lock.json tsconfig.json ./
RUN npm install
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist
COPY public ./public

EXPOSE 3000

CMD ["node", "dist/server.js"]
