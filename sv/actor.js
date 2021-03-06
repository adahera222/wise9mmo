var sys = require('sys');
var g = require("./global");
var main = require("./main");


// PC

function pcDie() {
    for(;;){
        var puttype=-1;
        if( this.stoneLeft > 0 ){
            puttype = g.BlockType.STONE;
            this.stoneLeft --;
        }
        if( this.soilLeft > 0 ){
            puttype = g.BlockType.SOIL;
            this.soilLeft--;
        }
        if( this.waterLeft > 0 ){
            puttype = g.BlockType.WATER;
            this.waterLeft --;
        }
        if( this.stemLeft > 0 ){
            puttype = g.BlockType.STEM;
            this.stemLeft--;
        }
            

        if( puttype == -1 )break;

        var x = Math.floor( this.pos.x - 5 + Math.random() * 10 );
        var y = Math.floor( this.pos.y + Math.random() * 10 );
        var z = Math.floor( this.pos.z - 5 + Math.random() * 10 );

        this.field.addDebri( puttype, new g.Vector3(x,y,z));
        
    }
}

function pcMove( curTime ) {
    if( this.hp <= 0 ){
        if( this.died == false ){
            this.conn.send("died");
        }
        this.died = true;
        this.lastInputForce = 0;
    } 
    
    if( this.lastInputForce != undefined ){
        this.vForce = this.lastInputForce;
    } else {
        this.vForce = 0;
    }

    if( this.lastToolRecover < ( curTime - 4000)  ){
        if( this.pickaxeLeft < 10 ) this.pickaxeLeft ++;
        if( this.axeLeft < 10 ) this.axeLeft ++;
        if( this.bucketLeft < 10 ) this.bucketLeft ++;
        if( this.bowLeft < 10 ) this.bowLeft ++;
        if( this.torchLeft < 10 ) this.torchLeft ++;

        this.lastToolRecover = curTime;
        this.sendToolState();
    }


    
    var col = this.collide( 0.5 );
    for( var i in col ){
        var a = col[i];
        if(!a)continue;
        var doIt=false;

        if( a == this.shooter ) continue;
        if( a.typeName == "STONE_debri" ){
            if( this.stoneLeft < 10 ) {
                this.stoneLeft ++;
                doIt =true;
            }
        }
        if( a.typeName == "SOIL_debri" ){
            if( this.soilLeft < 10 ){
                this.soilLeft ++;
                doIt = true;
            }
        }
        if( a.typeName == "STEM_debri" ){
            if( this.stemLeft < 10 ){
                this.stemLeft ++;
                doIt = true;
            }
        }
        if( a.typeName == "WATER_debri" ){
            if( this.waterLeft < 10 ){
                this.waterLeft ++;
                doIt = true;
            }
        }
            
        if( doIt ){
            this.sendToolState();
            this.field.deleteActor(a.id);
        }
    }

    var blkcur = this.getPosBlock( this.pos, this.width, this.height, false );
    if( blkcur == g.BlockType.WATER ){
        if( curTime > ( this.lastChoke + 2000 ) ){
            if( this.hp > 0 ){
                this.hp --;
                this.lastChoke = curTime;
                this.sendStatus();
            }
        }
    } else {
        if( curTime > ( this.lastHPRecover + 4000 ) ){
            this.lastHPRecover = curTime;
            if( this.hp < 10 ){
                this.hp ++;
                this.sendStatus();
                sys.puts("hprecov");
            }
        }
    }
    
    return true;
};

// デブリ
function debriMove( curTime ) {
    this.pitch += 1 * this.dTime;
    if( this.pitch > Math.PI*2 ){
        this.pitch = 0;
    }
    if( curTime > ( this.createdAt + 10000 ) ){
        var p = this.pos.toPos();
        this.field.runtimeSet( p, this.debriType );
        sys.puts( "debri fixed!");
        return false;
    }
    return true;
};


function mobballHitwall(p,xok,yok,zok) {
    sys.puts( "bulletHitWall: p:"+p.to_s() + " ok:" + xok + ","+ yok +","+zok );
    main.nearcast( this.pos, "hitNotify", this.id, this.pos.x, this.pos.y, this.pos.z );
    if( Math.random() < 0.5 ) {
        this.field.addMob( "ghost", p );
    } else {
        this.field.addMob( "zombie", p );
    }
                          
    return false;
}

function blackstarMove( curTime ) {
    if( this.hp <= 0 ){
        main.nearcast( this.pos, "smoke", this.pos.x, this.pos.y, this.pos.z );
        return false;
    }
    this.velocity.y = 0;

    if( ( this.counter % 300) == 0 ){
        // pc 全員にターゲット
        var enemyCnt=0;
        for(var k in this.field.actors ) {
            var a = this.field.actors[k];
            if( a == null )continue;
            if( a.typeName == "zombie"|| a.typeName == "ghost" ) enemyCnt++;
        }
        if( enemyCnt < 5 ){
            for(var k in this.field.actors ) {
                var a = this.field.actors[k];
                if( a == null )continue;
                if(a.typeName == "pc" ){
                    sys.puts("pc found at:" + a.pos.to_s() );
                    var b = this.shootAt( "mobball", 8, 20, 1, 100, a.pos );
                    b.hitWallFunc = mobballHitwall;
                    b.sendMark = false;
                    main.nearcast( this.pos, "fire", this.pos.x, this.pos.y, this.pos.z, "mobball" );
                }
            }
        }
    }
    return true;
    
}
function blackstarAttacked( attacker, dmg ) {
    sys.puts( "blackstarAttacked: attacker:" + attacker + " dmg:" + dmg );
    this.hp -= dmg;

    this.sendDamaged();
    this.sendStatus();
    
    if( this.hp <= 0 ){
        this.hp = this.maxhp;
        this.pos.x = this.field.hSize * Math.random();
        this.pos.z = this.field.hSize * Math.random();
    }

}


    
function ghostMove( curTime ) {
    if( this.hp <= 0 ){
        main.nearcast( this.pos, "smoke", this.pos.x, this.pos.y, this.pos.z );
        return false;
    }

    
    this.velocity.y = 0;

    this.updateHate(curTime, 30);
    var diff = this.pos.diff( this.targetPos ) ;
    
    this.pitch = this.pos.getPitch( diff );

    if( this.counter > 100 && ( this.counter % 100 ) == 0 && this.hate ){
        var b = this.shootAt( "fireball", 8, 5, 2, 1000, this.targetPos );
        b.sendMark = false;
        main.nearcast( this.pos, "fire", this.pos.x, this.pos.y, this.pos.z, "fireball" );
    }
    
    if( diff.length() > 10 ){
        this.vForce  = 2.0;
    }  else {
        this.vForce = -2.0;
    }
    if( this.pos.y < ( this.bornAtPos.y  ) ){
        this.velocity.y = 1;
    } else {
        this.velocity.y = -1;
    }
    if( this.counter < 100 ) this.vForce = 0;
    
    

    return true;
}
function ghostAttacked( attacker, dmg ) {
    sys.puts( "ghostAttacked: attacker:" + attacker + " dmg:" + dmg );
    this.hp -= dmg;

    this.sendDamaged();
    this.sendStatus();
    
};

// 目的地はいつも近くのpc
// pcと距離が2以内だったら攻撃
// 常にpcの方にむく
// hateはたまに更新
// まずxyから pitchを決めて進もうとし、前にブロックがあったらジャンプ、し続ける
// 穴があったら素直に落ちる
// 経路探索しない
function zombieMove( curTime ) {
    if( this.hp <= 0 ){
        main.nearcast( this.pos, "smoke", this.pos.x, this.pos.y, this.pos.z );
        return false;
    }

    if( this.inWater ){
        if( this.chokeAt == 0 ){
            this.chokeAt = curTime;
        } else {
            if( curTime > ( this.chokeAt + 2000 ) ){
                this.hp --;
                this.chokeAt = curTime;
                sys.puts( "choke.." );
            }
        }
    }

    this.updateHate(curTime,10);
    
    var diff = this.pos.diff( this.targetPos ) ;
    
    this.pitch = this.pos.getPitch( diff );

    if( this.pos.hDistance( this.targetPos ) < 0.1 ){
        this.vForce = 0;
    } else {
        this.vForce = 2.0;
    }
    if( this.counter < 100 ){
        this.vForce = 0;
    }
    /////////////

    // 障害物あったらジャンプ
    if( ( this.counter % 50 ) == 0 ){
        //        sys.puts("z: lastxyz:" + this.lastXOK + "," + this.lastZOK + " velY:" + this.velocity.y );
        if( ( this.lastXOK == false || this.lastZOK == false ) && this.velocity.y == 0 ){
            this.velocity.y = 4.0;
            main.nearcast( this.pos, "jumpNotify", this.id, this.velocity.y ); 
        }

        if( Math.random() < 0.2 ){
            main.nearcast( this.pos, "moanNotify", "zombie", this.id, this.pos.x, this.pos.y, this.pos.z  );
        }
    }

    this.yaw = 0;

    var col = this.collide( this.width  );
    for( var i in col ) {
        var a = col[i];
        if( a.typeName == "pc" ){
            sys.puts(" Zattack!! i:"+i );
            a.attacked( 2, this, true );
        }
    }
    return true;
}

function zombieAttacked( attacker, dmg ) {
    this.hp -= dmg;
}


var defaultTick = 30; // ms

var actorID = 1;
function Actor( name, fld, pos ) {

    var d = new Date();

    this.typeName = name;


    // 共用
    this.antiGravity = 1; // 大きくすると落ちにくい
    this.pos = new g.Vector3( pos.x, pos.y, pos.z );
    this.prevPos = new g.Vector3( pos.x, pos.y, pos.z );
    
    this.createdAt = d.getTime();    
    this.lastMoveAt = this.createdAt;
    this.lastSentAt = this.nextMoveAt = this.lastMoveAt + defaultTick;
    
    this.field = fld;
    this.func = null;
    this.id = actorID + 1000; 
    actorID++;

    this.hitWallFunc = null; // 壁に触れた
        
    this.counter = 0;
    this.toSend = true;

    this.yaw = 0;
    this.pitch = 0;


    this.height = 1;
    this.width = 1;
    
    // 以下、移動関連
    this.velocity = new g.Vector3(0,0,0);
    this.pitch = 0.0;
    this.yaw = 0.0;
    this.vForce = 0.0;
    this.useForce = true;
    this.lastXOK = this.lastYOK = this.lastZOK = true;
};

// ある点を中心とした地形ヒット判定用座標16個を返す
function getHitCoords( pos, s, h ) {
    var out = new Array(16);
    out[0] = pos.add(new g.Vector3(-s,0,s));
    out[1] = pos.add(new g.Vector3(s,0,s));
    out[2] = pos.add(new g.Vector3(-s,0,-s));
    out[3] = pos.add(new g.Vector3(s,0,-s));
    out[4] = pos.add(new g.Vector3(0,0,s));
    out[5] = pos.add(new g.Vector3(s,0,0));
    out[6] = pos.add(new g.Vector3(-s,0,0));
    out[7] = pos.add(new g.Vector3(0,0,-s));

    var hv = new g.Vector3(0,h,0);
    out[8] = out[0].add(hv);
    out[9] = out[1].add(hv);
    out[10] = out[2].add(hv);
    out[11] = out[3].add(hv);
    out[12] = out[4].add(hv);
    out[13] = out[5].add(hv);
    out[14] = out[6].add(hv);
    out[15] = out[7].add(hv);
    return out;
};
// いまいる位置にブロックあったら返す
// pos:Vector3
Actor.prototype.getPosBlock = function( pos, s, h, dolog ) {
    var dCoords = getHitCoords( pos, s,h );
    //    if( this.typeName=="pc") sys.puts( "out:" + dCoords[15].to_s());
        
    var blk=null;
    for(var i=0;i<dCoords.length;i++){
        var v = dCoords[i];

        var b = this.field.get( v.ix(), v.iy(), v.iz());
        if( b != null ){
            blk = b;
            if( blk != g.BlockType.AIR ){
                if( dolog ){
                    sys.puts( "getPosBlock hit v:" + v.to_s() + " s:" + s + " h:" + h);
                }

                return b;
            }
        }
    }
    return blk;
};




Actor.prototype.poll = function(curTime) {


    if( ( this.nextMoveAt >= curTime )  ) return;
    
    //        if( this.typeName=="pc"){
//                sys.puts( "vely:" + this.velocity.y + " posy:" + this.pos.y);
    //        }
    
    var dTime = ( curTime - this.lastMoveAt ) / 1000.0;
    this.dTime = dTime;
    this.lastMoveAt = curTime;
    this.nextMoveAt = curTime + defaultTick;
    
    // 挙動関数呼び出し
    if( this.func != null ){
        var ret= this.func.apply( this, [curTime]);
        if( ret == false ){
            this.field.deleteActor(this.id);
            return;
        }
    }

    this.counter ++;

    // 物理的に動かす

    var dnose = new g.Vector3(0,0,0);

    dnose.x = 1.0 * Math.cos(this.pitch);
    dnose.y = 0; // サーバではyawは見ていない
    dnose.z = 1.0 * Math.sin(this.pitch);

    if( this.useForce ){
        this.velocity.x = dnose.x * this.vForce;// * dTime;
        this.velocity.z = dnose.z * this.vForce; //* dTime;
        //        if( this.typeName=="pc"){
        //            if( this.toPos != null ){
        //                sys.puts("dt:" + dTime + "vf:" + this.vForce + " nzx:" + dnose.x + " nzz:" + dnose.z + " velx:" + this.velocity.x + " velz:"+this.velocity.z + " x:" + this.pos.x + " y:" + this.pos.y + " tox:" + this.toPos.x + " toy:" + this.toPos.y );
        //            }
        //        }
    }


    var gr = 6.5 / this.antiGravity;
    if( this.inWater==true){
        gr /= 8;
        this.velocity.x /= 2;
        this.velocity.z /= 2;        
    }
    this.velocity.y -= gr * dTime;

    var nextpos = this.pos.add( this.velocity.mul(dTime) );

    
    if( this.toPos != undefined && this.toPos != null ) {
        // 目的地が設定されてる場合は
        var dirV = this.pos.diff(this.toPos);  // this.pos -> toPos
        if( dirV.length() < 0.01 ){
            this.toPos = null;
        } else {
            //            if( this.typeName=="pc") sys.puts("to go: pos:" + this.pos.to_s() + " topos:" + this.toPos.to_s() + " dirv:" + dirV.to_s() + " dirVd:" + dirV.mul(dTime).to_s() + " ixyz:" + this.pos.ix() + ","+this.pos.iy() + "," + this.pos.iz()  + " vf:" + this.vForce );

            dirV = dirV.normalized().mul(this.vForce);

            nextpos = new g.Vector3( nextpos.x + dirV.mul(dTime).x,
                                     nextpos.y,
                                     nextpos.z + dirV.mul(dTime).z );
            
            // 到達したらtoposを初期化
            var cursign = this.toPos.diffSign( this.pos );
            var nextsign = this.toPos.diffSign( nextpos );
            //            if(this.typeName=="pc") sys.puts( "cursign:" + cursign.to_s() + " nsign:"+ nextsign.to_s() );

            if( cursign.diff( nextsign ).equal( new g.Vector3(0,0,0)) == false ){
                nextpos = this.toPos;
                this.toPos = null;
                                if(this.typeName=="pc")                sys.puts( "goal! pos:" + this.pos.to_s() );
            }            
        }
    }

    this.vForce = 0;

    
    //    var blkcur = this.field.get( this.pos.ix(), this.pos.iy(), this.pos.iz() );
    var blkcur = this.getPosBlock( this.pos, this.width, this.height, false );
    if( blkcur != null ){
        if( blkcur == g.BlockType.WATER ){
            // 水の中にいる
            this.inWater = true;
            if( this.prevInWater == false ){
                this.velocity.y=0;
            } else {
                if( this.velocity.y < -1 ){
                    this.velocity.y = -1;
                }
            }
        } else {
            this.inWater = false;
            if( g.isSolidBlock(blkcur) ){
                // 壁の中にいま、まさにうまってる
                this.pos.y += 1;
                this.velocity.y = 0;
                sys.puts( "inwall!! h:"+this.height + " tn:" + this.typeName );
            }
        } 
     }

    
    //    if( this.typeName == "pc")    sys.puts( "poll. tn:" + this.typeName + " pos:" + this.pos.to_s() + " v:" + this.velocity.to_s() );    

    var diffVec = this.pos.diff( nextpos );
    var bloopn = Math.floor(  diffVec.length() ) + 1;

    var x_ok = false;
    var y_ok = false;
    var z_ok = false;

    //        if( this.typeName=="pc") sys.puts( "LOOPN: " + bloopn  + " len:" + diffVec.length() );
    for( var bi = 0; bi < bloopn; bi++ ){
        var u = (bi + 1) / bloopn;

        var np = this.pos.mul(1-u).add( nextpos.mul(u));

        // 地形との境界面で微妙に振動するのをふせぐ
        var logflg=false;
        if( this.typeName == "arrow" ){
            sys.puts( "np:" + np.to_s() + " blkn:" + blkn +  " s:" + this.width + " h:" + this.height );            
            logflg=true;
        }
        
        var blkn = this.getPosBlock( np, this.width, this.height, logflg );



        
        // 範囲外はつねに移動できない
        if( blkn == null ){
            x_ok = y_ok = z_ok = false;
            break;
        }
        
        //        if( this.typeName=="pc") sys.puts("HITTTTTTTT: np:"+np.to_s()+ " v:" + this.velocity.to_s() );
        if( !g.isSolidBlock(blkn) ){
            x_ok = y_ok = z_ok = true;
            this.pos = np;
            continue;
        } 

            
        // 通れない場合はループ終わりで抜ける
        var np2 = new g.Vector3( this.pos.x, np.y, this.pos.z );
        var blkcur2 = this.getPosBlock( np2, this.width, this.height, false );
        if( blkcur2 != null && (!g.isSolidBlock(blkcur2)) ) y_ok = true;

        var np3 = new g.Vector3( this.pos.x, this.pos.y, np.z );
        var blkcur3 = this.getPosBlock( np3, this.width, this.height , false );
        if( blkcur3 != null && (!g.isSolidBlock(blkcur3)) ) z_ok = true;
    
        var np4 = new g.Vector3( np.x, this.pos.y, this.pos.z );
        var blkcur4 = this.getPosBlock( np4, this.width, this.height, false );
        if( blkcur4 != null && (!g.isSolidBlock(blkcur4)) ) x_ok = true;

        if( this.hitWallFunc ){
            var ret = this.hitWallFunc.apply( this, [new g.Pos( np.ix(), np.iy(), np.iz() ), x_ok, y_ok, z_ok ] );
            if( ret == false ){
                sys.puts( "x,y,z:" + np4.to_s() + "," + np2.to_s() + "," + np3.to_s() + " b2:" + blkcur2 + " b3:" + blkcur3 + " b4:" + blkcur4 );
                
                this.field.deleteActor(this.id);
                return;
            }
        }

        var finalnextpos = this.pos;
        if( x_ok ) finalnextpos.x = np.x;
        
        
        //        if( this.typeName == "pc" ) sys.puts( "################## yok:" + y_ok );
        if( y_ok ) {
            finalnextpos.y = np.y;
        } else {
            this.velocity.y =0;
        }
        if( z_ok ) finalnextpos.z = np.z;


        
        this.pos = finalnextpos;

        break;
    }

    if(this.pos.x<0){ this.pos.x=0; x_ok=false; }
    if(this.pos.y<0){ this.pos.y=0; y_ok=false; }    
    if(this.pos.z<0){ this.pos.z=0; z_ok=false; }

    this.lastXOK = x_ok;
    this.lastYOK = y_ok;
    this.lastZOK = z_ok;
    


    
    // 送信. 落ちてる最中ではない場合は、あまり多く送らない
    var toSend = false;
    if( this.counter == 1 ) toSend = true;
    if( this.lastSentAt < (curTime-500) ) toSend = true;
    if( this.velocity.y != 0 && ( this.lastSentAt < ( curTime-50) ) ) toSend = true;

    if( toSend && this.toSend == true ){
        //        sys.puts( "yaw:" + this.yaw + " id:" + this.id + " tn:" + this.typeName );
        main.nearcast( this.pos,
                       "moveNotify",
                       this.id,
                       this.typeName,
                       this.pos.x,
                       this.pos.y,
                       this.pos.z,
                       this.vForce,
                       this.pitch,
                       this.yaw,
                       this.velocity.y,
                       (curTime - this.lastSentAt) / 1000.0,
                       this.antiGravity,
                       this.hp,
                       this.maxhp
                       );
        this.lastSentAt = curTime;
    } 


    if( this.sendMark ){
        main.nearcast( this.pos, "markNotify", this.pos.x, this.pos.y, this.pos.z );
    }
    this.prevInWater = this.inWater;

    this.prevPos.copy( this.pos );

};

// args: すべて float 
Actor.prototype.setMove = function( x, y, z, sp, pitch, yaw ) {
    this.yaw = yaw;
    this.pitch = pitch;
    
    if( sp > g.PlayerMaxForce ) sp = g.PlayerMaxForce;
    this.lastInputForce = sp;
    
    var v = new g.Vector3(x,y,z);
    if( this.pos.equal(v) == false ){
        this.toPos = v;
    }


};

    
// velY: float
Actor.prototype.jump = function( velY ) {
    sys.puts( "jump: curvelY:" + this.velocity.y + " givenVelY:" + velY  );
    if( velY > 6 )return;
    this.prevJumpGivenVelY = velY;
    
    if( this.inWater == true ){
        this.velocity.y = velY;
    } else {
        this.velocity.y = velY;
    }
    main.nearcast( this.pos, "jumpNotify", this.id, velY );    
};

// dmg:整数
// attacker:actor
Actor.prototype.attacked = function( dmg, attacker, reverseKnockback ) {
    if( this.attackedFunc ){
        this.attackedFunc.apply( this, [ attacker, dmg ] );
    }
    if( reverseKnockback){
        var dv = this.pos.diff( attacker.pos ).normalized();
        sys.puts( "rev dv:" + dv.to_s());
        attacker.knockBack(dv.mul(3));
        main.nearcast( attacker.pos, "hitNotify", this.id, this.pos.x, this.pos.y, this.pos.z );
    } else  {
        var dv = attacker.pos.diff( this.pos ).normalized();
        sys.puts( "norm dv:" + dv.to_s());
        this.knockBack(dv.mul(3));
        main.nearcast( this.pos, "hitNotify", this.id, this.pos.x, this.pos.y, this.pos.z );
    }
};

Actor.prototype.knockBack = function( v ) {
    this.setMove( this.pos.x + v.x,
                  this.pos.y,
                  this.pos.z + v.z,
                  v.length(),
                  this.pitch,
                  this.yaw );
    this.jump(1);
    main.nearcast( this.pos, "jumpNotify", this.id, this.velocity.y );
    
};

// 球の衝突判定.当たったactorすべての配列を返す
Actor.prototype.collide = function( dia ) {
    var ret = new Array();
    for(var k in this.field.actors ) {
        var a = this.field.actors[k];
        if(!a)continue;
        var d = a.pos.diff( this.pos).length();
        if( a != null && //(d < (dia+this.width+a.width) ) &&
            (d<dia)&&
            //            a.pos.y < (this.pos.y+this.height) &&
            //            this.pos.y <(a.pos.y+a.height) &&
            a != this ){
            ret.push(a);
        }
    }
    return ret;
};

// PC

function pcHitWall(p,xok,yok,zok) {
    //        sys.puts( "pcHitGround: p:"  + p.to_s()+ "ok:" + xok + ","+ yok + "," + zok  + " vel:" + this.velocity.to_s() );
    if( this.velocity.y < -4 && yok == false ){
        var dmg = Math.round( ( this.velocity.y + 4 ) / 2 ); // 負の値
        if( dmg != 0 ){
            this.hp += dmg;
            sys.puts( "fall damage! me: " + this.typeName + " dmg:" + dmg );
            this.sendStatus();                
        }
    }
    return true;
};

function pcAttacked( attacker, dmg ) {
    sys.puts( "pcAttacked: attacker:" + attacker + " dmg:" + dmg );
    this.hp -= dmg;

    this.sendDamaged();
    this.sendStatus();
    
};

function PlayerCharacter( name, fld, pos ) {
    var pc = new Actor( "pc", fld, pos);
    pc.bornAtPos = pos;
    pc.playerName = name;
    pc.hp = pc.maxhp = 10;
    pc.hitWallFunc = pcHitWall;
    pc.attackedFunc = pcAttacked;
    pc.func = pcMove;
    pc.height = 1.7;
    pc.width = 0.35;
    pc.lastInputForce = 0;

    pc.died = false;
    
    // いくらでも時間で増えるもの
    pc.pickaxeLeft = 5;
    pc.axeLeft = 5;
    pc.bowLeft = 5;
    pc.bucketLeft = 5;
    pc.torchLeft = 5;

    // 拾う必要があるもの
    pc.stoneLeft = 0;
    pc.soilLeft = 0;
    pc.waterLeft = 0;
    pc.stemLeft = 0;
    pc.bombFlowerLeft = 0;
    
    pc.lastToolRecover = 0;
    pc.lastHPRecover = 0;
    pc.lastChoke = 0;
    
    // 関数
    pc.onDie = pcDie;
    
    return pc;
};
function Mob( name, fld, pos ) {
    var m = new Actor(name,fld,pos);
    m.bornAtPos = pos;
    if(name=="zombie"){
        m.func = zombieMove;
        m.height = 1.7;
        m.width = 0.35;
        m.hp = m.maxhp = 3;
        m.attackedFunc = zombieAttacked;
        m.chokeAt = 0;
    } else if( name == "ghost" ){
        m.func = ghostMove;
        m.height = 1.0;
        m.width = 1.0;
        m.hp = m.maxhp = 3;
        m.attackedFunc = ghostAttacked;
        m.chokeAt = 0;
        m.antiGravity = 1000; // ほぼ落ちない
    } else if( name == "blackstar" ) {
        m.func = blackstarMove;
        m.height = 4.0;
        m.width = 4.0;
        m.hp = m.maxhp = 10;
        m.attackedFunc = blackstarAttacked;
        m.antiGravity = 1000;
    }

    return m;
};
function Debri( t, fld, pos ) {
    var n = g.BlockTypeToString(t);
    if( n==null )throw "invalid block type:"+t;    
    var d = new Actor( n + "_debri",fld,pos);
    d.func = debriMove;
    d.debriType = t;
    d.height = 0.35;
    d.width = 0.35;
    return d;
};

function bulletMove( curTime ) {
    if( this.inWater )return false;

    //    sys.puts("bmove. pos:" + this.pos.to_s()  + " vel:" + this.velocity.to_s() + " nxmat:" + this.nextMoveAt + " dieat:" + this.dieAt );

    var col = this.collide( 1 );　
    for( var i in col ){
        var a = col[i];
        if( a == this.shooter ) continue;
        sys.puts( "collide:" + a.typeName + " d:" + this.pos.diff( a.pos ).length() );
        a.attacked( this.damage, this, false );
        return false;
    }

    if( this.nextMoveAt > this.dieAt ){
        sys.puts( "bullet: TTL. die");
        return false;
    }
    return true;
};

// speed: (m/sec)
// dtl: distance to live. (m)
function bulletHitWall(p,xok,yok,zok){
    sys.puts( "bulletHitWall: p:"+p.to_s() + " ok:" + xok + ","+ yok +","+zok );
    main.nearcast( this.pos, "hitNotify", this.id, this.pos.x, this.pos.y, this.pos.z );
    return false;
};

function Bullet( tname, fld, pos, shooter, pitch, yaw, speed, ttlsec, damage ) {

    var cameraHeight = 1;

    var v = new g.Vector3( Math.cos(pitch), yaw - cameraHeight, Math.sin(pitch) );

    var vel = v.normalized().mul(speed);
    var putpos = new g.Vector3( pos.x, pos.y + cameraHeight, pos.z );
    var b = new Actor( tname, fld, putpos );

    b.pitch = pitch;
    b.yaw = yaw;
    b.useForce = false; // 放物線

    b.velocity = vel;
    
    
    b.height = 0.1;
    b.width = 0.1;
    b.origPos = pos;
    b.dieAt = b.createdAt + ttlsec * 1000;
    b.damage = damage;
    b.shooter = shooter;
    b.direction = v.normalized();
    b.func = bulletMove;
    b.sendMark = true;
    if( tname=="hidden"){ // 透明で見えないフラグ
        b.toSend = false;
    }

    b.hitWallFunc = bulletHitWall;

    this.landingAt = 0;
    
    return b;    
};

// tname : "hidden"だとmove送らない
Actor.prototype.shoot = function( tname, speed, ttlsec, damage, antig) {
    var b = new Bullet( tname, this.field, this.pos, this, this.pitch, this.yaw, speed, ttlsec, damage );
    b.antiGravity = antig;
    this.field.addActor(b);
    return b;
};
// 位置指定でうつ
Actor.prototype.shootAt = function( tname, speed, ttlsec, damage, antig, atpos ) {
    var b = new Bullet( tname, this.field, this.pos, this, 0,0, speed, ttlsec, damage );
    b.antiGravity = antig;
    b.velocity = this.pos.diff(atpos).normalized().mul(speed);
    this.field.addActor(b);
    return b;
}
    

Actor.prototype.sendToolState = function(){
    this.conn.send( "toolState",
                    this.pickaxeLeft, this.axeLeft, this.torchLeft, this.bowLeft, this.bucketLeft,
                    this.stoneLeft, this.soilLeft, this.waterLeft, this.stemLeft, this.bombFlowerLeft );
};

Actor.prototype.sendStatus = function() {
    main.nearcast( this.pos, "statusChange", this.id, this.hp );
};
Actor.prototype.sendDamaged  = function() {
    if( this.conn ){
        this.conn.send( "damaged" );
    }
};

Actor.prototype.updateHate = function( curTime, dia ) {
    if( this.hate == undefined ) this.hate = null;

    if( ( this.counter % 10 ) == 0 ){
        var pcs = this.field.searchLatestNearPC( this.pos, dia, curTime - 1000 );
        if( pcs.length > 0 ){
            this.hate = pcs[0];
        } else {
            this.hate = null;
        }
    }
    
    if( this.hate ){
        this.targetPos = new g.Vector3( this.hate.pos.x, this.hate.pos.y, this.hate.pos.z );
    } else {
        this.targetPos = this.bornAtPos;
    }    
};

exports.Actor = Actor;
exports.Mob = Mob;
exports.Debri = Debri;
exports.Bullet = Bullet;
exports.PlayerCharacter = PlayerCharacter;
