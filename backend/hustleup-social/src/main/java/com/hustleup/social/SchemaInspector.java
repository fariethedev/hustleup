import java.sql.*;

public class SchemaInspector {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:mysql://localhost:3306/hustleup?useSSL=false";
        String user = "root";
        String password = "francis";
        
        try (Connection conn = DriverManager.getConnection(url, user, password)) {
            DatabaseMetaData metaData = conn.getMetaData();
            
            String[] tables = {"stories", "posts", "users"};
            for (String table : tables) {
                System.out.println("\n--- Table: " + table + " ---");
                try (ResultSet rs = metaData.getColumns(null, null, table, null)) {
                    while (rs.next()) {
                        System.out.println("Column: " + rs.getString("COLUMN_NAME") + 
                                         ", Type: " + rs.getString("TYPE_NAME") + 
                                         ", Size: " + rs.getInt("COLUMN_SIZE"));
                    }
                }
                
                System.out.println("--- Foreign Keys for " + table + " ---");
                try (ResultSet rs = metaData.getImportedKeys(null, null, table)) {
                    while (rs.next()) {
                        System.out.println("FK: " + rs.getString("FK_NAME") + 
                                         ", Table: " + rs.getString("FKTABLE_NAME") + 
                                         ", Column: " + rs.getString("FKCOLUMN_NAME") + 
                                         " -> PK Table: " + rs.getString("PKTABLE_NAME") + 
                                         ", PK Column: " + rs.getString("PKCOLUMN_NAME"));
                    }
                }
            }
        }
    }
}
