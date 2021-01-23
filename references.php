<div class="section color-2" id="pub-grid">
    <div class="section-container">
        <h2 class="title">References</h2>

        <div class="row">
            <div class="col-md-12">
                <div class="pitems">

                    <?php

                    $references = file_get_contents('references.json');
                    $references = json_decode($references, true);

                    foreach ($references as $reference) { ?>

                        <div class="item mix cpaper" data-year="<?php echo $reference['year']; ?>">
                            <div class="pubmain">
                                <div class="pubassets">

                                    <a href="#" class="pubcollapse">
                                        <i class="fa fa-expand"></i>
                                    </a>
                                    <a href="<?php echo $reference['link']; ?>"
                                       class="tooltips" title="External link" target="_blank">
                                        <i class="fa fa-external-link"></i>
                                    </a>

                                </div>
                                <h4 class="pubtitle"><a
                                            name="<?php echo $reference['name']; ?>"></a><?php echo $reference['title'] . " [" . $reference['name']  . "]"; ?>

                                </h4>
                                <div class="pubauthor"><?php echo $reference['authors']; ?></div>
                                <div class="pubcite"><span
                                            class="label label-warning"><?php echo $reference['type']; ?> Paper</span>
                                    <?php echo $reference['publisher']; ?>
                                </div>

                            </div>
                            <div class="pubdetails">
                                <h4>Abstract</h4>
                                <p><?php echo $reference['abstract']; ?></p>
                            </div>
                        </div>

                    <?php } ?>

                </div>
            </div>
        </div>
    </div>
</div>