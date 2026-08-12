mysqldump: [Warning] Using a password on the command line interface can be insecure.
Warning: A partial dump from a server that has GTIDs will by default include the GTIDs of all transactions, even those that changed suppressed parts of the database. If you don't want to restore GTIDs, pass --set-gtid-purged=OFF. To make a complete dump, pass --all-databases --triggers --routines --events. 
Warning: A dump from a server that has GTIDs enabled will by default include the GTIDs of all transactions, even those that were executed during its extraction and might not be represented in the dumped data. This might result in an inconsistent data dump. 
In order to ensure a consistent backup of the database, pass --single-transaction or --lock-all-tables or --source-data. 
-- MySQL dump 10.13  Distrib 9.5.0, for Win64 (x86_64)
--
-- Host: localhost    Database: hustleup
-- ------------------------------------------------------
-- Server version	9.5.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- GTID state at the beginning of the backup 
--

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '0d04ef67-b4ef-11f0-b512-1065304b4506:1-951';

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` binary(16) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `message` text NOT NULL,
  `notification_type` varchar(255) NOT NULL,
  `is_read` bit(1) DEFAULT NULL,
  `reference_id` varchar(36) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `user_id` binary(16) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (_binary '%—+l$Eh\ZÊ›½ƒ	l','2026-04-21 21:18:15.358042','Yoo','DIRECT_MESSAGE',_binary '\0','1db83ce4-551a-4a','New message from Yeat',_binary 'Æ™\ZA»KD§îŸŽ£¦E\ñ'),(_binary '6\ëž\Â\ÈrCÈ’\ÜK¬ü\×\ä\r','2026-04-21 21:49:44.861675','Yoo','DIRECT_MESSAGE',_binary '\0','1db83ce4-551a-4a','New message from Yeat',_binary '#\Ñ\Æ7•(I>†Y\ô\×$~c\\'),(_binary 'T\çv@¢³NÜ½\èŽC\ìo\ð_','2026-04-21 21:32:21.010576','Yoo','DIRECT_MESSAGE',_binary '\0','1db83ce4-551a-4a','New message from Yeat',_binary 'ÆüS\â_F\ñ‚ý—^>\Z)='),(_binary '`\×>ƒNÿ¸D\è 9ü','2026-04-15 17:54:38.901331','Hi! I just placed an order for \"Luxury Scented Candles â€” Hanâ€¦','DIRECT_MESSAGE',_binary '\0','cdf77877-28dc-40','New message from Hustlr',_binary '#\Ñ\Æ7•(I>†Y\ô\×$~c\\'),(_binary 'zÀ	j\Z˜Aš®\õdˆ\á’s%','2026-04-21 21:36:35.869991','Yo','DIRECT_MESSAGE',_binary '\0','1db83ce4-551a-4a','New message from Yeat',_binary 'bšACøNŽ†À^X>\á±'),(_binary '‰\æ•C\õ†D6žt] ²\'\r','2026-04-15 17:49:37.248376','Twinn','DIRECT_MESSAGE',_binary '\0','cdf77877-28dc-40','New message from Hustlr',_binary 'ÆüS\â_F\ñ‚ý—^>\Z)='),(_binary '\Ø}He:Aˆ©y\'\ìD\ä\è','2026-04-21 22:13:45.918761','Yoo','DIRECT_MESSAGE',_binary '\0','1db83ce4-551a-4a','New message from Yeat',_binary 'Æ™\ZA»KD§îŸŽ£¦E\ñ'),(_binary '\àt†\×\ØI\÷‚e.^','2026-04-21 22:30:31.961939','Yoo','DIRECT_MESSAGE',_binary '\0','8f54b5ff-b54c-4b','New message from Farai',_binary '¸<\äU\ZJªºä¤±.\íA'),(_binary '\äpøR³\÷E¿±|3\Üx-…\Ò','2026-04-21 21:50:22.623473','Yo','DIRECT_MESSAGE',_binary '\0','1db83ce4-551a-4a','New message from Yeat',_binary '~\ÏZ&¨I}¡jV\õùh\Ô'),(_binary '\å/*·;GAÊ¨\Ì\ó°ý\ç.','2026-04-11 16:17:16.060761','yo','DIRECT_MESSAGE',_binary '\0','c69dfc53-e25f-46','New message from joeboy',_binary '\Í\÷xw(\Ü@D§\â\ßLz('),(_binary '\õ\áO\ò¬aJP°C\Ç\ð¾²>','2026-04-15 17:49:37.586044','Twin','DIRECT_MESSAGE',_binary '\0','cdf77877-28dc-40','New message from Hustlr',_binary 'ÆüS\â_F\ñ‚ý—^>\Z)=');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-28  9:26:53
