<?php

if (1) {
    mysql_query("SELECT * FROM USERS WHERE ID = '" . ($id) . "'");
} else {
    mysqli_query($conn, "SELECT * FROM USERS WHERE ID = '" . mysql_escape_string($id) . "'");
}

?>
