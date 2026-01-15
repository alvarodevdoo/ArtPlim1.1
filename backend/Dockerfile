FROM node:18

# Instalar pnpm
RUN npm install -g pnpm

# Instalar postgresql-client para pg_isready
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar package.json e pnpm-lock.yaml
COPY package*.json pnpm-lock.yaml* ./

# Instalar dependências
RUN pnpm install --frozen-lockfile

# Copiar código fonte
COPY . .

# Tornar o script executável
RUN chmod +x start.sh

# Expor porta
EXPOSE 3001

# Comando padrão
CMD ["./start.sh"]