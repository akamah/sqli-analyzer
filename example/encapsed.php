<?php

$var = $_POST['dangerous'];
$con = mysqli_connect("127.0.0.1", "username", "password", "database");

$conn->mysqli_query("SELECT * FROM USERS WHERE ID = '{$user->id}'");

$con->close();

?>
