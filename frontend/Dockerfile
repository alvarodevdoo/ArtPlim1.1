FROM node:18-alpine

# Instalar pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copiar package.json e pnpm-lock.yaml
COPY package*.json pnpm-lock.yaml* ./

# Instalar dependências
RUN pnpm install --frozen-lockfile

# Copiar código fonte
COPY . .

# Expor porta
EXPOSE 3000

# Comando padrão
CMD ["pnpm", "run", "dev"]