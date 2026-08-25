# syntax=docker/dockerfile:1
# Build context is the REPO ROOT (not backend/), because Railway's root-directory
# setting is dashboard-only while the Dockerfile path can be set via
# RAILWAY_DOCKERFILE_PATH. Keeping the context at the root lets the whole deploy be
# driven from the CLI. See .dockerignore for what gets excluded.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Every module POM must be present: Maven constructs the full reactor from <modules>
# in the parent POM before -pl prunes it, so a missing child pom.xml fails the build.
# POMs change rarely, so this layer caches across source-only rebuilds.
COPY backend/pom.xml .
COPY backend/hustleup-common/pom.xml hustleup-common/
COPY backend/hustleup-auth/pom.xml hustleup-auth/
COPY backend/hustleup-social/pom.xml hustleup-social/
COPY backend/hustleup-marketplace/pom.xml hustleup-marketplace/
COPY backend/hustleup-subscription/pom.xml hustleup-subscription/
COPY backend/hustleup-notification/pom.xml hustleup-notification/
COPY backend/hustleup-gateway/pom.xml hustleup-gateway/

# Only the sources this service actually needs.
COPY backend/hustleup-common/src hustleup-common/src
COPY backend/hustleup-auth/src hustleup-auth/src

RUN mvn -B -pl hustleup-auth -am package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /build/hustleup-auth/target/hustleup-auth-1.0.0.jar app.jar
# preferIPv6Addresses: Railway private networking is IPv6; Java otherwise picks IPv4
# when a hostname resolves to both, which breaks *.railway.internal lookups.
ENV JAVA_OPTS="-Xmx400m -XX:+UseSerialGC -Djava.net.preferIPv6Addresses=true"
EXPOSE 8081
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar app.jar"]