FROM node:20

WORKDIR /dist

RUN chmod -R 777 /dist
# Instala sudo para permitir ejecutar comandos como superusuario
RUN apt-get update && apt-get install -y sudo

# Crea el usuario usuariofiel
RUN useradd -m -s /bin/bash usuariofiel

# Otorga permisos de superusuario al usuario usuariofiel para un comando específico
RUN echo "usuariofiel ALL=(ALL) NOPASSWD: /bin/bash" >> /etc/sudoers

# Cambia al usuario usuariofiel


# Copia los archivos y ejecuta el comando build
COPY package*.json ./
USER root
RUN sudo npm install
COPY . .
RUN npm install -g @nestjs/cli
RUN npm run build

USER usuariofiel
# Comando para iniciar la aplicación
CMD ["npm", "run", "start:prod"]