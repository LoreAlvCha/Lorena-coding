# Usa una imagen ligera de Node
FROM node:18-alpine
 
# Crea el directorio de trabajo
WORKDIR /app
 
# Copia los archivos de dependencias y las instala
COPY package*.json ./
RUN npm install
 
# Copia el resto del código
COPY . .
 
# Esto protege node_modules del volumen
VOLUME ["/app/node_modules"]

# Expone el puerto que usa tu app
EXPOSE 3000
 
# Comando para arrancar la app
CMD ["node", "app.js"]