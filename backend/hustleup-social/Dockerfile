# syntax=docker/dockerfile:1
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Every module POM must be present: Maven constructs the full reactor from <modules>
# in the parent POM before -pl prunes it, so a missing child pom.xml fails the build.
# POMs change rarely, so this layer caches across source-only rebuilds.
COPY pom.xml .
COPY hustleup-common/pom.xml hustleup-common/
COPY hustleup-auth/pom.xml hustleup-auth/
COPY hustleup-social/pom.xml hustleup-social/
COPY hustleup-marketplace/pom.xml hustleup-marketplace/
COPY hustleup-subscription/pom.xml hustleup-subscription/
COPY hustleup-notification/pom.xml hustleup-notification/
COPY hustleup-gateway/pom.xml hustleup-gateway/

# Only the sources this service actually needs.
COPY hustleup-common/src hustleup-common/src
COPY hustleup-social/src hustleup-social/src

RUN mvn -B -pl hustleup-social -am package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /build/hustleup-social/target/hustleup-social-1.0.0.jar app.jar
# preferIPv6Addresses: Railway private networking is IPv6; Java otherwise picks IPv4
# when a hostname resolves to both, which breaks *.railway.internal lookups.
ENV JAVA_OPTS="-Xmx448m -XX:+UseSerialGC -Djava.net.preferIPv6Addresses=true"
EXPOSE 8082
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar app.jar"]