# ---------- Etapa 1: construcción ----------
FROM eclipse-temurin:25.0.4_7-jdk-noble AS build

WORKDIR /build

# Primero solo lo imprescindible para resolver dependencias.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw -B dependency:go-offline

# El código va después, a propósito: si solo cambia el código,
# Docker reutiliza la capa anterior y no vuelve a descargar nada.
COPY src/ src/
RUN ./mvnw -B clean package -DskipTests

# ---------- Etapa 2: ejecución ----------
FROM eclipse-temurin:25.0.4_7-jre-noble AS runtime

# El contenedor no corre como root.
RUN useradd --system --create-home --uid 1001 nodoaula

WORKDIR /app
COPY --from=build --chown=nodoaula:nodoaula /build/target/*.jar app.jar

USER nodoaula

# La instancia gratuita de Render tiene 512 MB (ADR-004).
# El 25% restante queda para metaspace, hilos y memoria nativa de la JVM.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0"

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
