<?php

$var = $_POST['dangerous'];
$con = mysqli_connect("127.0.0.1", "username", "password", "database");

mysqli_query($con, "select * from table where id ='" . mysqli_escape_string($con, $var) . "'");
mysqli_query($con, "select * from table where id ='" . mysql_real_escape_string($var) . "'");

mysqli_set_charset($conn, 'utf8');

mysql_query("SELECT * FROM table");
mysqli_query($con, "select * from table where id = '" . mysqli_real_escape_string($cnn, $var));
mysqli_query($con, $select . " * from table where id = 'hoge'");
mysqli_query($con, "select * from " . mysqli_real_escape_string($con, $table) . mysqli_real_escape_string($con, $where) . "id = hoge");
mysqli_query($con, 'select * from table where id =""' . mysqli_real_escape_string($con, $var) . '"');
mysqli_query($con, "select * from table where id =''" . mysqli_real_escape_string($con, $var) . "'");
mysqli_query($con, "select * from table where id ='" . $var . "'");
mysqli_query($con); // no argument



// should be ok
mysqli_query($con, "select * from table where id ='" . mysqli_escape_string($con, $var) . "'");
$con->query("select * from table where id = 'poyo'");

mysqli_close($con);

?>