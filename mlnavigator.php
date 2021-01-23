<!DOCTYPE html>
<html lang="pl">
<head>
    <title>BBednarczyk - GML Complexity Navigator</title>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="author" content="owwwlab.com">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">

    <link rel="shortcut icon" href="../favicon.ico">

    <!--CSS styles-->
    <link rel="stylesheet" href="css/bootstrap.css">
    <link rel="stylesheet" href="css/font-awesome.min.css">
    <link rel="stylesheet" href="css/perfect-scrollbar-0.4.5.min.css">
    <link rel="stylesheet" href="css/magnific-popup.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/mlnavigator.css">
    <link id="theme-style" rel="stylesheet" href="css/styles/default.css">


    <!--/CSS styles-->
    <script type="text/javascript" src="js/jquery-1.11.3.min.js"></script>
    <script type="text/javascript" src="js/TweenMax.min.js"></script>
    <script type="text/javascript" src="js/jquery.touchSwipe.min.js"></script>
    <script type="text/javascript" src="js/jquery.carouFredSel-6.2.1-packed.js"></script>

    <script type="text/javascript" src="js/modernizr.custom.63321.js"></script>
    <script type="text/javascript" src="js/jquery.dropdownit.js"></script>

    <script type="text/javascript" src="js/ScrollToPlugin.min.js"></script>

    <script type="text/javascript" src="js/bootstrap.min.js"></script>

    <script type="text/javascript" src="js/jquery.mixitup.min.js"></script>

    <script type="text/javascript" src="js/masonry.min.js"></script>

    <script type="text/javascript" src="js/perfect-scrollbar-0.4.5.with-mousewheel.min.js"></script>
    <script type="text/javascript" src="js/jquery.nicescroll.min.js"></script>


    <script type="text/javascript" src="js/magnific-popup.js"></script>
    <script type="text/javascript" src="js/custom.js"></script>

    <!--/ML NAVIGATOR CODE-->

    <script type="text/javascript" src="navigator/mlnavigator.js"></script>
    <script type="text/javascript" src="navigator/data.js"></script>

    <!--MATHJAX-->

    <script type="text/javascript" src="http://latex.codecogs.com/latexit.js"></script>
    <script type="text/javascript">
    LatexIT.add('td',true);
    </script>

</head>
<body>

<div id="wrapper">
    <a href="#sidebar" class="mobilemenu"><i class="fa fa-reorder"></i></a>
    <div id="sidebar">
        <div id="sidebar-wrapper">
            <div id="sidebar-inner">
                <!-- Profile/logo section-->
                <div id="profile" class="clearfix">
                    <div class="portrate hidden-xs"></div>
                    <div class="title">
                        <h2>Bartosz Bednarczyk</h2>
                        <h3>TU Dresden</h3>
                        <h3>University of Wrocław</h3>
                    </div>
                </div>
                <!-- /Profile/logo section-->

                <!-- Main navigation-->
                <div id="main-nav">
                    <ul id="navigation">
                        <li>
                            <a href="index.html">
                                <i class="fa fa-home"></i>
                                <div class="text">Home Page</div>
                            </a>
                        </li>

                        <li>
                            <a href="aboutme.html">
                                <i class="fa fa-user"></i>
                                <div class="text">About Me [PL]</div>
                            </a>
                        </li>

                        <li>
                            <a href="research.html">
                                <i class="fa fa-book"></i>
                                <div class="text">Research</div>
                            </a>
                        </li>

                        <li>
                            <a href="publications.html">
                                <i class="fa fa-edit"></i>
                                <div class="text">Publications</div>
                            </a>
                        </li>

<!--                         <li>
                            <a href="teaching.html">
                                <i class="fa fa-clock-o"></i>
                                <div class="text">Teaching [PL]</div>
                            </a>
                        </li>
                        <li>
                            <a href="contact.html">
                                <i class="fa fa-calendar"></i>
                                <div class="text">Contact</div>
                            </a>
                        </li> -->
                    </ul>
                </div>
                <!-- /Main navigation-->
                <!-- Sidebar footer -->
                <div id="sidebar-footer">
                    <div class="social-icons">
                        <ul>
                            <li><a href="https://www.facebook.com/bartosz.jan.bednarczyk"><i class="fa fa-facebook"></i></a>
                            </li>
                            <li><a href="https://github.com/wiedzmac"><i class="fa fa-github"></i></a></li>
                            <li><a href="https://stackexchange.com/users/5638561/bartosz-bednarczyk"><i
                                            class="fa fa-stack-exchange"></i></a></li>

                        </ul>
                    </div>


                    <div id="copyright">Bartosz Bednarczyk © 2018</div>

                </div>
                <!-- /Sidebar footer -->
            </div>

        </div>
    </div>

    <div id="main">

        <div id="biography" class="page home" data-pos="home">
            <div class="pageheader">
                <div class="headercontent">
                    <div class="section-container">
                        <h2 class="title">GML Complexity Navigator</h2>
                    </div>
                </div>
            </div>

            <div class="pagecontents">
                <div class="section color-1" id="filters">
                    <div class="section-container">
                        <div class="row">
                            <div class="complexityContainer">
                                <div class="def">
                                    <div class="defTables">
                                        <div class="frameContainer">
                                            <table style="width: 100%">
                                                <tr>
                                                    <th colspan="3">
                                                        Frame property
                                                    </th>
                                                    <th>
                                                        Modal axiom
                                                    </th>
                                                    <th>
                                                        First order condition
                                                    </th>
                                                </tr>
                                                <tr>
                                                    <td>
                                                        <label>
                                                            <input type="checkbox" value="D"
                                                                   class="js-frame-checkbox js-logic">
                                                        </label>
                                                    </td>
                                                    <td>
                                                        D
                                                    </td>
                                                    <td>
                                                        Serial
                                                    </td>
                                                    <td>
                                                        $\Box p \rightarrow \Diamond p$
                                                    </td>
                                                    <td>
                                                        $\forall{x}.\exists{y}.R(x,y)$
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>
                                                        <label>
                                                            <input type="checkbox" value="T"
                                                                   class="js-frame-checkbox  js-logic">
                                                        </label>
                                                    </td>
                                                    <td>
                                                        T
                                                    </td>
                                                    <td>
                                                        Reflexive
                                                    </td>
                                                    <td>
                                                        $p \rightarrow \Diamond p$
                                                    </td>
                                                    <td>
                                                        $\forall{x}. R(x,x)$
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>
                                                        <label>
                                                            <input type="checkbox" value="B"
                                                                   class="js-frame-checkbox  js-logic">
                                                        </label>
                                                    </td>
                                                    <td>
                                                        B
                                                    </td>
                                                    <td>
                                                        Symmetric
                                                    </td>
                                                    <td>
                                                        $p \rightarrow \Box \Diamond p$
                                                    </td>
                                                    <td>
                                                        $\forall{x}. \forall{y}. R(x,y) \rightarrow R(y,x)$
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>
                                                        <label>
                                                            <input type="checkbox" value="4"
                                                                   class="js-frame-checkbox  js-logic">
                                                        </label>
                                                    </td>
                                                    <td>
                                                        4
                                                    </td>
                                                    <td>
                                                        Transitive
                                                    </td>
                                                    <td>
                                                        $\Diamond p \rightarrow \Box \Diamond p$
                                                    </td>
                                                    <td>
                                                        $\forall{x}.\forall{y}.\forall{z}. R(x,y) \wedge R(y,z) \rightarrow R(x,z)$
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>
                                                        <label>
                                                            <input type="checkbox" value="5"
                                                                   class="js-frame-checkbox  js-logic">
                                                        </label>
                                                    </td>
                                                    <td>
                                                        5
                                                    </td>
                                                    <td>
                                                        Euclidean
                                                    </td>
                                                    <td>
                                                        $\Box p \rightarrow \Box \Box p$
                                                    </td>
                                                    <td>
                                                        $\forall{x}.\forall{y}.\forall{y} R(x,y) \wedge R(x,z) \rightarrow R(y,z)$
                                                    </td>
                                                </tr>
                                            </table>
                                        </div>
                                        <div class="extContainer">
                                            <table style="width: 100%">
                                                <tr>
                                                    <th colspan="3">
                                                        Languages
                                                    </th>
                                                </tr>
                                                <tr>
                                                    <td>
                                                        <label>
                                                            <input type="radio" name="extension" value="ext1"
                                                                   class="js-logic">
                                                        </label>
                                                    </td>
                                                    <td>
                                                        ST
                                                    </td>
                                                    <td>
                                                        $\mathcal{L}^* = \Diamond$
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>
                                                        <label>
                                                            <input type="radio" name="extension" value="ext2"
                                                                   class="js-logic">
                                                        </label>
                                                    </td>
                                                    <td>
                                                        Gr
                                                    </td>
                                                    <td>
                                                        $\mathcal{L}^* = \Diamond_{\geq k}$
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>
                                                        <label>
                                                            <input type="radio" name="extension" value="ext3"
                                                                   class="js-logic">
                                                        </label>
                                                    </td>
                                                    <td>
                                                        I
                                                    </td>
                                                    <td>
                                                        $\mathcal{L}^* = \Diamond, \Diamond^{-1}$
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>
                                                        <label>
                                                            <input type="radio" name="extension" value="ext4"
                                                                   class="js-logic">
                                                        </label>
                                                    </td>
                                                    <td>
                                                        IGr
                                                    </td>
                                                    <td>
                                                        $\mathcal{L}^* = \Diamond_{\geq k}, \Diamond^{-1}$
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>
                                                        <label>
                                                            <input type="radio" name="extension" value="ext5"
                                                                   class="js-logic">
                                                        </label>
                                                    </td>
                                                    <td>
                                                        GrI
                                                    </td>
                                                    <td>
                                                        $\mathcal{L}^* =  \Diamond_{\geq k}, \Diamond^{-1}_{\geq k}$
                                                    </td>
                                                </tr>
                                            </table>
                                        </div>
                                    </div>
                                    <div class="selected">
                                        <div class="reset">
                                            <button class="js-reset">Reset</button>
                                        </div>
                                    </div>
                                    <div class="selected">
                                        <div class="logicNameDesc">
                                            You have selected modal logic:
                                            <div class="logicName"></div>
                                        </div>
                                    </div>
                                </div>
                                <div class="results">
                                    <div class="resultsTableContainer">
                                        <table width="100%">
                                            <tr>
                                                <th>Problem</th>
                                                <th>Complexity</th>
                                                <th>Comments and references</th>
                                            </tr>
                                            <tr>
                                                <td>
                                                    Local satisfiability
                                                </td>
                                                <td class="js-local-complex">

                                                </td>
                                                <td class="js-local-comment">

                                                </td>
                                            </tr>
                                            <tr>
                                                <td>
                                                    Global satisfiability
                                                </td>
                                                <td class="js-global-complex">

                                                </td>
                                                <td class="js-global-comment">

                                                </td>
                                            </tr>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            <?php include "references.php"; ?>

            </div>
        </div>
    </div>

</div>
</body>
</html>
