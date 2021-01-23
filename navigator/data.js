var implies = {
    "T": ["D"],
    "B,5": ["4"],
    "4,B": ["5"],
    "5,T": ["4","B"],
    "5,T": ["4","B"],
    "5,T": ["B"],
    "B,4,5,D":["B","4","5","D","T"]
};

var names = {
    "": {
        'ext1': 'K',
        'ext2': 'GrK',
        'ext3': 'IK',
        'ext4': 'IGrK',
        'ext5': 'GrIK'
    },
    "D": {
        'ext1': 'D',
        'ext2': 'GrD',
        'ext3': 'ID',
        'ext4': 'IGrD',
        'ext5': 'GrID'
    },
    "B": {
        'ext1': 'KB',
        'ext2': 'GrKB',
        'ext3': 'IKB',
        'ext4': 'IGrKB',
        'ext5': 'GrIKB'
    },
    "D,T": {
        'ext1': 'T',
        'ext2': 'GrT',
        'ext3': 'IT',
        'ext4': 'IGrT',
        'ext5': 'GrIT'
    },
    "B,D": {
        'ext1': 'DB',
        'ext2': 'GrDB',
        'ext3': 'IDB',
        'ext4': 'IGrDB',
        'ext5': 'GrIDB'
    },
    "B,D,T": {
        'ext1': 'TB',
        'ext2': 'GrTB',
        'ext3': 'ITB',
        'ext4': 'IGrTB',
        'ext5': 'GrITB'
    },
    "4": {
        'ext1': 'K4',
        'ext2': 'GrK4',
        'ext3': 'IK4',
        'ext4': 'IGrK4',
        'ext5': 'GrIK4'
    },
    "D,4": {
        'ext1': 'D4',
        'ext2': 'GrD4',
        'ext3': 'ID4',
        'ext4': 'IGrD4',
        'ext5': 'GrID4'
    },
    "D,T,4": {
        'ext1': 'S4',
        'ext2': 'GrS4',
        'ext3': 'IS4',
        'ext4': 'IGrS4',
        'ext5': 'GrIS4'
    },
    "5": {
        'ext1': 'K5',
        'ext2': 'GrK5',
        'ext3': 'IK5',
        'ext4': 'IGrK5',
        'ext5': 'GrIK5'
    },
    "D,5": {
        'ext1': 'KD5',
        'ext2': 'GrKD5',
        'ext3': 'IKD5',
        'ext4': 'IGrKD5',
        'ext5': 'GrIKD5'
    },
    "4,5": {
        'ext1': 'K45',
        'ext2': 'GrK45',
        'ext3': 'IK45',
        'ext4': 'IGrK45',
        'ext5': 'GrIK45'
    },
    "D,4,5": {
        'ext1': 'D45',
        'ext2': 'GrD45',
        'ext3': 'ID45',
        'ext4': 'IGrD45',
        'ext5': 'GrID45'
    },
    "B,4,5": {
        'ext1': 'KB45',
        'ext2': 'GrKB45',
        'ext3': 'IKB45',
        'ext4': 'IGrKB45',
        'ext5': 'GrIKB45'
    },
    "D,T,B,4,5": {
        'ext1': 'S5',
        'ext2': 'GrS5',
        'ext3': 'IS5',
        'ext4': 'IGrS5',
        'ext5': 'GrIS5'
    }
};

var displayNames = {
    "K": "K",
    "GrK": "GrK",
    "IK": "IK",
    "IGrK": "IGrK",
    "GrIK": "GrIK",

    "D": "D",
    "GrD": "GrD",
    "ID": "ID",
    "IGrD": "IGrD",
    "GrID": "GrID",

    "T": "T",
    "GrT": "GrT",
    "IT": "IT",
    "IGrT": "IGrT",
    "GrIT": "GrIT",

    "KB": "KB",
    "GrKB": "GrKB",
    "IKB": "IKB",
    "IGrKB": "IGrKB",
    "GrIKB": "GrIKB",

    "DB": "DB",
    "GrDB": "GrDB",
    "IDB": "IDB",
    "IGrDB": "IGrDB",
    "GrIDB": "GrIDB",

    "TB": "TB",
    "GrTB": "GrTB",
    "ITB": "ITB",
    "IGrTB": "IGrTB",
    "GrITB": "GrITB",

    "K4": "K4",
    "GrK4": "GrK4",
    "IK4": "IK4",
    "IGrK4": "IGrK4",
    "GrIK4": "GrIK4",

    "D4": "D4",
    "GrD4": "GrD4",
    "ID4": "ID4",
    "IGrD4": "IGrD4",
    "GrID4": "GrID4",

    "S4": "S4",
    "GrS4": "GrS4",
    "IS4": "IS4",
    "IGrS4": "IGrS4",
    "GrIS4": "GrIS4",

    "D5": "D5",
    "GrD5": "GrD5",
    "ID5": "ID5",
    "IGrD5": "IGrD5",
    "GrID5": "GrID5",

    "K5": "K5",
    "GrK5": "GrK5",
    "IK5": "IK5",
    "IGrK5": "IGrK5",
    "GrIK5": "GrIK5",

    "K45": "K45",
    "GrK45": "GrK45",
    "IK45": "IK45",
    "IGrK45": "IGrK45",
    "GrIK45": "GrIK45",

    "D45": "D45",
    "GrD45": "GrD45",
    "ID45": "ID45",
    "IGrD45": "IGrD45",
    "GrID45": "GrID45",

    "KB45": "KB45",
    "GrKB45": "GrKB45",
    "IKB45": "IKB45",
    "IGrKB45": "IGrKB45",
    "GrIKB45": "GrIKB45"
};

var results = {

    // Modal logic K


    "K": {
        "local-complex": "PSpace",
        "local-comment": "A classical results by Lander <a href='#Ladner77'>[Ladner77]</a>, the lower bound holds even for variable-free fragment <a href='#ChagrovR02'>[ChagrovR02]</a>. The upper bound holds even for Arithmetic Modal Logics <a href='#SchroderP08'>[SchroderP08]</a>.",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from PDL by a careful analysis by Schild <a href='#Schild91'>[Schild91]</a>. The upper bound holds even for Arithmetic Modal Logics <a href='#KupkePS15'>[KupkePS15]</a>."
    },
    "GrK": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from K. The upper bound holds even for Arithmetic Modal Logics <a href='#SchroderP08'>[SchroderP08]</a>.",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from K. The upper bound holds even for Arithmetic Modal Logics <a href='#KupkePS15'>[KupkePS15]</a>."
    },
    "IK": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from K, the upper bound holds for GrIK",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from K, the upper bound holds for GrIK"
    },
    "IGrK": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from K, the upper bound holds for GrIK",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from K, the upper bound holds for GrIK"
    },
    "GrIK": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from K, PSpace upper bound with a tableaux algorithm by Tobies <a href='#Tobies2001'>[Tobies2001]</a>.",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from K, the upper via a standard standard translation to GC2 <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>"
    },

    // Modal logic D

    "D": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from K, the upper bound holds for GrID",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from K, the upper bound holds for GrID"
    },
    "GrD": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from D, the upper bound holds for GrID",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from D, the upper bound holds for GrID"
    },
    "ID": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from D, the upper bound holds for GrID",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from D, the upper bound holds for GrID"
    },
    "IGrD": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from D, the upper bound holds for GrID",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from D, the upper bound holds for GrID"
    },
    "GrID": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from D, PSpace upper bound <a href='#BednarczykKW2018'>[BednarczykKW2018]</a> with a slight modification of a tableaux algorithm by Tobies <a href='#Tobies2001'>[Tobies2001]</a>.",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from D, the upper via a standard standard translation to GC2 <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>"
    },

    // Modal logic T

    "T": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from K, the upper bound holds for GrIT",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from K, the upper bound holds for GrIT"
    },
    "GrT": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from T, the upper bound holds for GrIT",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from T, the upper bound holds for GrIT"
    },
    "IT": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from T, the upper bound holds for GrIT",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from T, the upper bound holds for GrIT"
    },
    "IGrT": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from T, the upper bound holds for GrIT",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from T, the upper bound holds for GrIT"
    },
    "GrIT": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from T, PSpace upper bound <a href='#BednarczykKW2018'>[BednarczykKW2018]</a> with a slight modification of a tableaux algorithm by Tobies <a href='#Tobies2001'>[Tobies2001]</a>.",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from T, the upper via a standard standard translation to GC2 <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>"
    },

    // Modal logic KB

    "KB": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from K, the upper bound holds for GrKB",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from K, the upper bound holds for GrKB"
    },
    "GrKB": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from KB, PSpace upper bound <a href='#KazakovP09'>[KazakovP09]</a> with a slight modification of a tableaux algorithm by Tobies <a href='#Tobies2001'>[Tobies2001]</a>.",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from KB, the upper via a standard standard translation to GC2 <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>"
    },
    "IKB": {
        "local-complex": "PSpace",
        "local-comment": "Due to symmetricity, IKB = KB",
        "global-complex": "ExpTime",
        "global-comment": "Due to symmetricity, IKB = KB"
    },
    "IGrKB": {
        "local-complex": "PSpace",
        "local-comment": "Due to symmetricity, IGrKB = GrKB",
        "global-complex": "ExpTime",
        "global-comment": "Due to symmetricity, IGrKB = GrKB"
    },
    "GrIKB": {
        "local-complex": "PSpace",
        "local-comment": "Due to symmetricity, GrIKB = GrKB",
        "global-complex": "ExpTime",
        "global-comment": "Due to symmetricity, GrIKB = GrKB"
    },

    // Modal logic DB

    "DB": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from K, the upper bound holds for GrDB",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from K, the upper bound holds for GrDB"
    },
    "GrDB": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from DB, PSpace upper bound <a href='#KazakovP09'>[KazakovP09]</a> with a slight modification of a tableaux algorithm by Tobies <a href='#Tobies2001'>[Tobies2001]</a>.",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from DB, the upper via a standard standard translation to GC2 <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>"
    },
    "IDB": {
        "local-complex": "PSpace",
        "local-comment": "Due to symmetricity, IDB = DB",
        "global-complex": "ExpTime",
        "global-comment": "Due to symmetricity, IDB = DB"
    },
    "IGrDB": {
        "local-complex": "PSpace",
        "local-comment": "Due to symmetricity, IGrDB = GrDB",
        "global-complex": "ExpTime",
        "global-comment": "Due to symmetricity, IGrDB = GrDB"
    },
    "GrIDB": {
        "local-complex": "PSpace",
        "local-comment": "Due to symmetricity, GrIDB = GrDB",
        "global-complex": "ExpTime",
        "global-comment": "Due to symmetricity, GrIDB = GrDB"
    },


    // Modal logic TB

    "TB": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from K, the upper bound holds for GrTB",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from K, the upper bound holds for GrTB"
    },
    "GrTB": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from TB, PSpace upper bound <a href='#KazakovP09'>[KazakovP09]</a> with a slight modification of a tableaux algorithm by Tobies <a href='#Tobies2001'>[Tobies2001]</a>.",
        "global-complex": "ExpTime",
        "global-comment": "Hardness comes from TB, the upper via a standard standard translation to GC2 <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>"
    },
    "ITB": {
        "local-complex": "PSpace",
        "local-comment": "Due to symmetricity, ITB = TB",
        "global-complex": "ExpTime",
        "global-comment": "Due to symmetricity, ITB = TB"
    },
    "IGrTB": {
        "local-complex": "PSpace",
        "local-comment": "Due to symmetricity, IGrTB = GrTB",
        "global-complex": "ExpTime",
        "global-comment": "Due to symmetricity, IGrTB = GrTB"
    },
    "GrITB": {
        "local-complex": "PSpace",
        "local-comment": "Due to symmetricity, GrITB = GrTB",
        "global-complex": "ExpTime",
        "global-comment": "Due to symmetricity, GrITB = GrTB"
    },

    // Modal logic S5

    "S5": {
        "local-complex": "NP",
        "local-comment": "Hardness comes from SAT <a href='#Cook71'>[Cook71]</a>, the upper bound holds for GrS5",
        "global-complex": "NP",
        "global-comment": "Hardness comes from SAT <a href='#Cook71'>[Cook71]</a>, the upper bound holds for GrS5"
    },
    "GrS5": {
        "local-complex": "NP",
        "local-comment": "Hardness comes from S5, upper bound in <a href='#KazakovP09'>[KazakovP09]</a> via translation to C1",
        "global-complex": "NP",
        "global-comment": "Hardness comes from S5, upper bound in <a href='#Zolin17'>[Zolin17]</a>"
    },
    "IS5": {
        "local-complex": "NP",
        "local-comment": "Due to symmetricity, IS5 = S5",
        "global-complex": "NP",
        "global-comment": "Due to symmetricity, IS5 = S5"
    },
    "IGrS5": {
        "local-complex": "NP",
        "local-comment": "Due to symmetricity, IGrS5 = GrS5",
        "global-complex": "NP",
        "global-comment": "Due to symmetricity, IGrS5 = GrS5"
    },
    "GrIS5": {
        "local-complex": "NP",
        "local-comment": "Due to symmetricity, GrIS5 = GrS5",
        "global-complex": "NP",
        "global-comment": "Due to symmetricity, GrIS5 = GrS5"
    },

    // Modal logic KB45

    "KB45": {
        "local-complex": "NP",
        "local-comment": "Hardness comes from SAT <a href='#Cook71'>[Cook71]</a>, the upper bound holds for GrKB45",
        "global-complex": "NP",
        "global-comment": "Hardness comes from SAT <a href='#Cook71'>[Cook71]</a>, the upper bound holds for GrKB45"
    },
    "GrKB45": {
        "local-complex": "NP",
        "local-comment": "Hardness comes from KB45, upper bound in <a href='#KazakovP09'>[KazakovP09]</a> via translation to C1",
        "global-complex": "NP",
        "global-comment": "Hardness comes from KB45, a slight modification of a local satisfiability algorithm from <a href='#KazakovP09'>[KazakovP09]</a>"
    },
    "IKB45": {
        "local-complex": "NP",
        "local-comment": "Due to symmetricity, IKB45 = KB45",
        "global-complex": "NP",
        "global-comment": "Due to symmetricity, IKB45 = KB45"
    },
    "IGrKB45": {
        "local-complex": "NP",
        "local-comment": "Due to symmetricity, IGrKB45 = GrKB45",
        "global-complex": "NP",
        "global-comment": "Due to symmetricity, IGrKB45 = GrKB45"
    },
    "GrIKB45": {
        "local-complex": "NP",
        "local-comment": "Due to symmetricity, GrIKB45 = GrKB45",
        "global-complex": "NP",
        "global-comment": "Due to symmetricity, GrIKB45 = GrKB45"
    },

    // Modal logic D45

    "D45": {
        "local-complex": "NP",
        "local-comment": "Hardness comes from SAT <a href='#Cook71'>[Cook71]</a>, the upper bound holds for GrID45",
        "global-complex": "NP",
        "global-comment": "Hardness comes from SAT <a href='#Cook71'>[Cook71]</a>, the upper bound holds for GrID45"
    },
    "GrD45": {
        "local-complex": "NP",
        "local-comment": "Hardness comes from D45, the upper bound holds for GrID45",
        "global-complex": "NP",
        "global-comment": "Hardness comes from D45, the upper bound holds for GrID45"
    },
    "ID45": {
        "local-complex": "NP",
        "local-comment": "Hardness comes from D45, the upper bound holds for GrID45",
        "global-complex": "NP",
        "global-comment": "Hardness comes from D45, the upper bound holds for GrID45"
    },
    "IGrD45": {
        "local-complex": "NP",
        "local-comment": "Hardness comes from D45, the upper bound holds for GrID45",
        "global-complex": "NP",
        "global-comment": "Hardness comes from D45, the upper bound holds for GrID45"
    },
    "GrID45": {
        "local-complex": "NP",
        "local-comment": "Hardness comes from KB45, the upper bound in <a href='#BednarczykKW2018'>[BednarczykKW2018]</a> via translation to C1",
        "global-complex": "NP",
        "global-comment": "local sat = global sat <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>"
    },

    // Modal logic K45

    "K45": {
        "local-complex": "NP",
        "local-comment": "Hardness comes from SAT <a href='#Cook71'>[Cook71]</a>, the upper bound holds for GrIK45",
        "global-complex": "NP",
        "global-comment": "Hardness comes from SAT <a href='#Cook71'>[Cook71]</a>, the upper bound holds for GrIK45"
    },
    "GrK45": {
        "local-complex": "NP",
        "local-comment": "Hardness comes from K45, the upper bound holds for GrIK45",
        "global-complex": "NP",
        "global-comment": "Hardness comes from K45, the upper bound holds for GrIK45"
    },
    "IK45": {
        "local-complex": "NP",
        "local-comment": "Hardness comes from K45, the upper bound holds for GrIK45",
        "global-complex": "NP",
        "global-comment": "Hardness comes from K45, the upper bound holds for GrIK45"
    },
    "IGrK45": {
        "local-complex": "NP",
        "local-comment": "Hardness comes from K45, the upper bound holds for GrIK45",
        "global-complex": "NP",
        "global-comment": "Hardness comes from K45, the upper bound holds for GrIK45"
    },
    "GrIK45": {
        "local-complex": "NP",
        "local-comment": "Hardness comes from K45, the upper bound in <a href='#BednarczykKW2018'>[BednarczykKW2018]</a> via translation to C1",
        "global-complex": "NP",
        "global-comment": "local sat = global sat <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>"
    },

    // Modal logic K5

    "K5": {
        "local-complex": "NP",
        "local-comment": "Hardness comes from SAT <a href='#Cook71'>[Cook71]</a>, the upper bound holds for GrK5",
        "global-complex": "NP",
        "global-comment": "Hardness comes from SAT <a href='#Cook71'>[Cook71]</a>, the upper bound holds for GrK5"
    },
    "GrK5": {
        "local-complex": "NP",
        "local-comment": "Hardness comes from K5, upper bound in <a href='#KazakovP09'>[KazakovP09]</a> via translation to C1",
        "global-complex": "NP",
        "global-comment": "Hardness comes from K5, a slight modification of the translation to C1 from <a href='#KazakovP09'>[KazakovP09]</a>"
    },
    "IK5": {
        "local-complex": "ExpTime",
        "local-comment": "lower bound: reduction from alternating Turing machines in <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>, upper bound: <a href='#DemriN05'>[DemriN05]</a> via translation to GF2",
        "global-complex": "ExpTime",
        "global-comment": "local sat = global sat <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>"
    },
    "IGrK5": {
        "local-complex": "NExpTime",
        "local-comment": "Hardness comes from  <a href='#BednarczykKW2018'>[BednarczykKW2018]</a> via NExpTime-torus tilings, the upper bound holds for GrIK5",
        "global-complex": "NExpTime",
        "global-comment": "local sat = global sat <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>"
    },
    "GrIK5": {
        "local-complex": "NExpTime",
        "local-comment": "Hardness comes from IGrK5, the upper bound via translation to C2 in <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>",
        "global-complex": "NExpTime",
        "global-comment": "local sat = global sat <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>"
    },

    // Modal logic D5

    "D5": {
        "local-complex": "NP",
        "local-comment": "Hardness comes from SAT <a href='#Cook71'>[Cook71]</a>, the upper bound holds for GrD5",
        "global-complex": "NP",
        "global-comment": "Hardness comes from SAT <a href='#Cook71'>[Cook71]</a>, the upper bound holds for GrD5"
    },
    "GrD5": {
        "local-complex": "NP",
        "local-comment": "Hardness comes from D5, upper bound in <a href='#KazakovP09'>[KazakovP09]</a> via translation to C1",
        "global-complex": "NP",
        "global-comment": "Hardness comes from D5, a slight modification of the translation to C1 from <a href='#KazakovP09'>[KazakovP09]</a>"
    },
    "ID5": {
        "local-complex": "ExpTime",
        "local-comment": "lower bound: reduction from alternating Turing machines in <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>, upper bound: <a href='#DemriN05'>[DemriN05]</a> via translation to GF2",
        "global-complex": "ExpTime",
        "global-comment": "local sat = global sat <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>"
    },
    "IGrD5": {
        "local-complex": "NExpTime",
        "local-comment": "Hardness comes from  <a href='#BednarczykKW2018'>[BednarczykKW2018]</a> via NExpTime-torus tilings, the upper bound holds for GrID5",
        "global-complex": "NExpTime",
        "global-comment": "local sat = global sat <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>"
    },
    "GrID5": {
        "local-complex": "NExpTime",
        "local-comment": "Hardness comes from IGrD5, the upper bound via translation to C2 in <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>",
        "global-complex": "NExpTime",
        "global-comment": "local sat = global sat <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>"
    },

    // Modal logic K4

    "K4": {
        "local-complex": "PSpace",
        "local-comment": "A classical results by Lander <a href='#Ladner77'>[Ladner77]</a>, the lower bound holds even for variable-free fragment <a href='#ChagrovR02'>[ChagrovR02]</a>.",
        "global-complex": "NP",
        "global-comment": "Hardness comes from SAT <a href='#Cook71'>[Cook71]</a>, the upper bound holds for GrK4"
    },
    "GrK4": {
        "local-complex": "NExpTime",
        "local-comment": "Hardness and upper bound in <a href='#KazakovP09'>[KazakovP09]</a>",
        "global-complex": "NP",
        "global-comment": "Hardness comes from K4, upper bound in <a href='#Zolin17'>[Zolin17]</a>"
    },
    "IK4": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from K4, the upper bound in  <a href='#Spaan1993'>[Spaan1993]</a> ",
        "global-complex": "ExpTime",
        "global-comment": "lower bound: reduction from alternating Turing machines in <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>, upper bound: <a href='#DemriN05'>[DemriN05]</a> via translation to GF2"
    },
    "IGrK4": {
        "local-complex": "decidable in Tower, NExpTime-hard",
        "local-comment": "hardness comes from GrK4, upper bound in  <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>",
        "global-complex": "decidable in Tower, NExpTime-hard",
        "global-comment": "hardness comes from local satisfiability <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>"
    },
    "GrIK4": {
        "local-complex": "undecidable",
        "local-comment": "<a href='#Zolin17'>[Zolin17]</a>",
        "global-complex": "undecidable",
        "global-comment": "<a href='#Zolin17'>[Zolin17]</a>"
    },

    // Modal logic D4

    "D4": {
        "local-complex": "PSpace",
        "local-comment": "A classical results by Lander <a href='#Ladner77'>[Ladner77]</a>",
        "global-complex": "NP",
        "global-comment": "Hardness comes from SAT <a href='#Cook71'>[Cook71]</a>, the upper bound holds for GrD4"
    },
    "GrD4": {
        "local-complex": "NExpTime",
        "local-comment": "Hardness and upper bound in <a href='#KazakovP09'>[KazakovP09]</a>",
        "global-complex": "NP",
        "global-comment": "A slight modification of the algorithm from <a href='#Zolin17'>[Zolin17]</a>"
    },
    "ID4": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from D4, an easy adaptation of techniques for IK4 and IS4 from  <a href='#Spaan1993'>[Spaan1993]</a> ",
        "global-complex": "ExpTime",
        "global-comment": "lower bound: reduction from alternating Turing machines in <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>, upper bound: <a href='#DemriN05'>[DemriN05]</a> via translation to GF2"
    },
    "IGrD4": {
        "local-complex": "decidable in Tower, NExpTime-hard",
        "local-comment": "hardness comes from GrD4, upper bound in  <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>",
        "global-complex": "decidable in Tower, NExpTime-hard",
        "global-comment": "hardness comes from local satisfiability <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>"
    },
    "GrID4": {
        "local-complex": "undecidable",
        "local-comment": "<a href='#Zolin17'>[Zolin17]</a>",
        "global-complex": "undecidable",
        "global-comment": "<a href='#Zolin17'>[Zolin17]</a>"
    },

    // Modal logic S4

    "S4": {
        "local-complex": "PSpace",
        "local-comment": "A classical results by Lander <a href='#Ladner77'>[Ladner77]</a>, the lower bound holds even for single-variable fragment <a href='#ChagrovR02'>[ChagrovR02]</a>.",
        "global-complex": "NP",
        "global-comment": "Hardness comes from SAT <a href='#Cook71'>[Cook71]</a>, the upper bound holds for GrS4"
    },
    "GrS4": {
        "local-complex": "NExpTime",
        "local-comment": "Hardness and upper bound in <a href='#KazakovP09'>[KazakovP09]</a>",
        "global-complex": "NP",
        "global-comment": "Hardness comes from S4, upper bound in <a href='#Zolin17'>[Zolin17]</a>"
    },
    "IS4": {
        "local-complex": "PSpace",
        "local-comment": "Hardness comes from S4, the upper bound in  <a href='#Spaan1993'>[Spaan1993]</a> ",
        "global-complex": "ExpTime",
        "global-comment": "lower bound: reduction from alternating Turing machines in <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>, upper bound: <a href='#DemriN05'>[DemriN05]</a> via translation to GF2"
    },
    "IGrS4": {
        "local-complex": "decidable in Tower, NExpTime-hard",
        "local-comment": "hardness comes from GrS4, upper bound in  <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>",
        "global-complex": "decidable in Tower, NExpTime-hard",
        "global-comment": "hardness comes from local satisfiability <a href='#BednarczykKW2018'>[BednarczykKW2018]</a>"
    },
    "GrIS4": {
        "local-complex": "undecidable",
        "local-comment": "<a href='#Zolin17'>[Zolin17]</a>",
        "global-complex": "undecidable",
        "global-comment": "<a href='#Zolin17'>[Zolin17]</a>"
    }

};
