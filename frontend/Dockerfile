FROM node:22-alpine AS build

WORKDIR /app

ARG VITE_BACKEND_URL
ARG VITE_PB_URL
# Build version shown in the UI footer. Supplied by the caller (Coolify passes
# its SOURCE_COMMIT through) so the build never needs .git in the context.
ARG VITE_GIT_SHA
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
ENV VITE_PB_URL=${VITE_PB_URL}
ENV VITE_GIT_SHA=${VITE_GIT_SHA}

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
