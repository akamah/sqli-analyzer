<?php

if (1) {
    mysql_query("SELECT * FROM USERS WHERE ID = '" . ($id) . "'");
} else {
    mysql_query("SELECT * FROM USERS WHERE ID = '" . htmlspecialchars($id) . "'");
}

?>
