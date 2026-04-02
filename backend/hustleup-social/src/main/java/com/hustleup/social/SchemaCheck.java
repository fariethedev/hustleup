import java.sql.*;

public class SchemaCheck {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:mysql://localhost:3306/hustleup?useSSL=false";
        String user = "root";
        String password = "francis";
        
        try (Connection conn = DriverManager.getConnection(url, user, password)) {
            DatabaseMetaData metaData = conn.getMetaData();
            
            System.out.println("--- Table: users ---");
            try (ResultSet rs = metaData.getColumns(null, null, "users", "id")) {
                if (rs.next()) {
                    System.out.println("Column: id, Type: " + rs.getString("TYPE_NAME") + ", Size: " + rs.getInt("COLUMN_SIZE"));
                }
            }
            
            System.out.println("--- Table: stories ---");
            try (ResultSet rs = metaData.getColumns(null, null, "stories", "author_id")) {
                if (rs.next()) {
                    System.out.println("Column: author_id, Type: " + rs.getString("TYPE_NAME") + ", Size: " + rs.getInt("COLUMN_SIZE"));
                }
            }
            
            System.out.println("--- Table: posts ---");
            try (ResultSet rs = metaData.getColumns(null, null, "posts", "author_id")) {
                if (rs.next()) {
                    System.out.println("Column: author_id, Type: " + rs.getString("TYPE_NAME") + ", Size: " + rs.getInt("COLUMN_SIZE"));
                }
            }
        }
    }
}
