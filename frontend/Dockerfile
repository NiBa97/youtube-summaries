FROM node:22-alpine AS build

RUN apk add --no-cache git

WORKDIR /app

ARG VITE_BACKEND_URL
ARG VITE_PB_URL
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
ENV VITE_PB_URL=${VITE_PB_URL}

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# .git is only needed so vite.config.ts can resolve VITE_GIT_SHA at build
# time (`docker build` context is the repo root for this reason); it never
# reaches the runtime image below.
COPY .git ./.git
COPY frontend/. .
RUN npm run build


FROM nginx:1.27-alpine AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
