# ── Build effectué en local (npm run build) avant docker build ────
# Le dossier dist/ doit exister avant de lancer le build Docker.
FROM nginx:1.26-alpine

COPY dist/ /usr/share/nginx/html
COPY nginx-frontend.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
