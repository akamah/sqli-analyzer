<?php

if (1) {
    mysql_query("SELECT * FROM USERS WHERE ID = '" . ($id) . "'");
} else {
    mysqli::query("SELECT * FROM USERS WHERE ID = '" . mysql_escape_string($id) . "'");
}

?>
