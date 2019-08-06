function Serializable() {}

Serializable.prototype.load = function( obj )
{
  $.extend( this, obj );
};

var STORAGE_ACTION_CLOSE = 0;
var STORAGE_ACTION_LOAD  = 1;
var STORAGE_ACTION_SAVE  = 2;
var CONFIRMATION = " This game data cannot be recovered!\n\nDo you want to continue?";
var DELETE_MSG = "You are about to delete the selected saved game." + CONFIRMATION;
var OVERWRITE_MSG = "You are about to overwrite the selected saved game." + CONFIRMATION;

function GameInfo()
{
  this.version = 1;
  this.dungeon_info = Dungeon;
  this.player_info = Player;
  this.game_time = Time.time;
  this.icon = DrawPlayer.get_data_url();
  this.spellbar = SpellBar;
  this.status_effects = StatusEffects.effects;
  
  var now = new Date();
  var months = new Array("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec");
  var minutes = now.getMinutes();
  
  if( minutes < 10 )
  {
    minutes = "0" + minutes;
  }
  
  this.timestamp = months[now.getMonth()] + " " + now.getDate() + " " + now.getFullYear() + " @ " + now.getHours() + ":" + minutes;
  this.description = $("#new_save_desc").val();
}

function GameStorage()
{
  this.selected_game = -1;
  this.action       = STORAGE_ACTION_CLOSE;
  this.saved_games  = [];
    
  this.popup = $("#storage");
  this.popup.modal({ 
                show: false,
                remote: "html/storage.html"
          });
  this.popup.on( "show.bs.modal", open_dialog );
  this.popup.on( "shown.bs.modal", function() {
                Storage.refresh_ui();
          });
  this.popup.on( "hide.bs.modal", close_dialog );
  
  this.refresh_ui = function()
  {
    $("#new_save_btn").button();
    $("#new_save_desc").val("");
    
    this.no_games_msg = $("#no_games_msg");
    this.games_list   = $("#stored_games");
    this.save_error   = $("#save_error");
    var new_save_div = $("#new_save_div");
    var title = $("#storage_title");
    var ok_btn = $("#storage_ok" );
    
    if( this.action == STORAGE_ACTION_LOAD )
    {
      title.text( "Load Game" );
      ok_btn.text( "Load game" );
      new_save_div.hide();
    }
    else
    {
      title.text( "Save Game" );
      ok_btn.text( "Save game" );
      new_save_div.show();
    }
     
    this.save_error.hide();
    this.prepare_stored_games_list();
  };
  
  this.overwrite_save = function()
  {
    if( this.selected_game > -1 )
    {
      if( confirm( OVERWRITE_MSG ) )
      {
        var new_save = new GameInfo();
        new_save.description = this.saved_games[this.selected_game].description;
        this.saved_games[this.selected_game] = new_save;
        return true;
      }

      return false; 
    }
    
    return true;
  };
  
  this.new_save = function()
  {
    if( this.saved_games.length < 3 )
    {
      if( $.trim( $("#new_save_desc").val() ).length > 0 )
      {
        this.saved_games.push( new GameInfo() );
        this.commit_store();
        document.game.dirty = false;
        this.action = STORAGE_ACTION_CLOSE;
        this.popup.modal("hide");
      }
      else
      {
        this.save_error.show().text( "You must enter a description for a new saved game." );
      }
    }
    else
    {
      this.save_error.show().html( "You currently have the maximum allowed number of saved games.<br/>Delete an existing saved game or select one to overwrite." );
    }
  };
  
  this.delete_game = function( obj )
  {
    var ix = $("#stored_games li").index( $(obj).parent() );
    
    if( ix > -1 && confirm( DELETE_MSG ) )
    {
      this.saved_games.remove( ix );
      $("#stored_games li:eq("+ix+")").remove();
      this.selected_game = -1;
      
      if( this.saved_games.length == 0 )
      {
        this.no_games_msg.show();
      }
    }
  };
  
  this.commit_store = function()
  {
    $.jStorage.set( "game", this.saved_games );
  };
  
  this.load_selected_game = function()
  {
    try
    {
      if( this.selected_game > -1 )
      {
        var saved_game = this.saved_games[this.selected_game];
        Dungeon.load( saved_game.dungeon_info );
        Player = new PlayerActor();
        Player.load( saved_game.player_info );
        SpellBar.load( saved_game.spellbar );
        StatusEffects.load( saved_game.status_effects );
        Time.time = saved_game.game_time;
        
        Time.update_time();
        Player.update_stats();
        Dungeon.update_level();
        SpellBar.update_toolbar();
        Inventory.load();
        DrawPlayer.construct_paperdoll();
        Map.center_map_on_location( Player.location );
        
        document.game.bind_events();
        document.game.draw();
      }
    }
    catch( err )
    {
      Log.add( "An error has occurred while loading saved game data." );
      Log.debug( err.message );
    }
  };
  
  this.erase = function()
  {
    $.jStorage.flush();
    this.saved_games = [];
    Log.debug( "Erased LocalStorage cache." );
  };
  
  this.load_map = function( new_tiles )
  {
    var map_tiles = new Array();
    
    for( var row = 0; row < new_tiles.length; ++row )
    {
      map_tiles[row] = this.load_collection( new_tiles[row], Tile );
    }
    
    return map_tiles;
  };
  
  this.load_collection = function( src, TYPE )
  {
    var dest = [];
    
    for( var ix = 0; ix < src.length; ++ix )
    {
      var obj = new TYPE();
      obj.load( src[ix] );
      dest.push( obj );
    }
    
    return dest;
  };
  
  this.load_point = function( src )
  {
    var location = new Point();
    location.load( src );
    return location;
  };
  
  function open_popup( action )
  {
    if( !is_processing() )
    {
      Storage.saved_games = $.jStorage.get("game") || [];
      Storage.action = action;
      Storage.selected_game = -1;
      Storage.popup.modal("show");
    }
  }
  
  this.get_num_saved_games = function()
  {
    return ( $.jStorage.get("game") || []).length;
  };
  
  this.open_load = function()
  {
    open_popup( STORAGE_ACTION_LOAD );
  };
  
  this.open_save = function()
  { 
    open_popup( STORAGE_ACTION_SAVE );
  };
  
  this.prepare_stored_games_list = function()
  {
    this.games_list.empty();
    
    if( this.saved_games.length > 0 )
    {
      this.no_games_msg.hide();
      build_game_list();
    }
    else
    {
      this.no_games_msg.show();
    } 
  };
  
  this.close_action = function()
  {
    if( this.action == STORAGE_ACTION_LOAD )
    {
      if( Player == null || !is_dirty() || confirm( "You are currently in a game. Any unsaved progress will be lost.\n\nDo you want to continue?" ) )
      {
        this.load_selected_game();
        this.commit_store();
        return true;
      }
    }
    else if( this.action == STORAGE_ACTION_SAVE )
    {
      var result = this.overwrite_save();
      this.commit_store();
      document.game.dirty = false;
      return result;
    }
    
    return false;
  };
  
  this.ok = function()
  { 
    if( this.close_action() )
    {
      this.popup.modal("hide");
    }
  };
  
  function get_html_for_single_game( info )
  {
    var html = "<li class=\"ui-widget-content\" style=\"cursor:pointer;\">";
    html += "<img src=\"" + info.icon + "\" class=\"Avatar\"></img><div style=\"display:inline-block;width:500px;margin-right:5px;\">";
    html += "<span class=\"StoredGameTitle\">" + info.description + "</span><br/><div class=\"StoredGameInfo\">";
    html += "<span class=\"StatName\">" + info.player_info.description + " (Level " + info.player_info.level + ")</span>";
    html += "<span style=\"float:right;\">Last Modified: " + info.timestamp + "</span>";
    
    var saved_time = new GameTime();
    saved_time.time = info.game_time;
    html += "<span class=\"StatName\">Game Time: " + saved_time.get_time() + "</span></div></div>";
    html += "<button class=\"btn btn-danger btn-delete\" onclick=\"Storage.delete_game(this);\"><span class=\"glyphicon glyphicon-remove\"></span></button></li>";

    return html;
  }
  
  function build_game_list()
  {
    for( var ix = 0; ix < Storage.saved_games.length; ix++ )
    {
      Storage.games_list.append( get_html_for_single_game( Storage.saved_games[ix] ) );
    }
    
    Storage.games_list.selectable({ selecting: function(event, ui){
                                      if( $(".ui-selected, .ui-selecting").length > 1 ) {
                                        $(ui.selecting).removeClass("ui-selecting");
                                      }
                                    },
                                    selected: function(event, ui) {
                                        var new_selection = $("#stored_games li").index( ui.selected );
                                        if( new_selection == Storage.selected_game )
                                        {
                                          $(ui.selected).removeClass("ui-selected");
                                          Storage.selected_game = -1; 
                                        }
                                        else
                                          Storage.selected_game = new_selection;    
                                      }
                                   
                                });
  }
}var VIEWPORT_WIDTH  = 30;
var VIEWPORT_HEIGHT = 15;
var VIEWPORT_SHIFT  = 2;
var COMBINED_TILE_COLS = 12;
var MIN_X = 0;
var MIN_Y = 0;
var TILE_WIDTH = 32;
var TILE_DRAG_BUFFER = 12;
var MAX_X = VIEWPORT_WIDTH * TILE_WIDTH;
var MAX_Y = VIEWPORT_HEIGHT * TILE_WIDTH;
var Log = null;
var Loader = null;
var Images = null;
var Map = null;
var Player = null;
var Inventory = null;
var Dungeon = null;
var Time = null;
var Storage = null;
var DrawPlayer = null;
var SpellBar = null;
var CustomizeSpellBar = null;
var NewGame = null;
var CharInfo = null;
var StatusEffects = null;

var NO_COMMAND     = "0";
var SPLAT          = 0;
var FIZZLE         = 1;

var CLOSED = 0;
var OPEN   = 1;
var SECRET = 2;
var BROKEN = 3;

var TIME_STANDARD_MOVE = 6;
var ROUNDS_IN_ONE_MIN = 10;

var STAIRS_UP = 0;
var STAIRS_DOWN = 1;

var OPEN_DIALOGS = 0;

function open_dialog()
{
  cancel_action();
  OPEN_DIALOGS++;
}

function close_dialog()
{
  if( OPEN_DIALOGS > 0 )
  {
    OPEN_DIALOGS--;
  }
}

// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to)
{
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};

Array.prototype.shuffle = function()
{
  for (var j, x, i = this.length; i; j = parseInt(Math.random() * i), x = this[--i], this[i] = this[j], this[j] = x);
  return this;
};

Number.prototype.toCommas = function()
{ 
   var n = this,
   t = ',',
   sign = (n < 0) ? '-' : '',

   //extracting the absolute value of the integer part of the number and converting to string
   i = parseInt(n = Math.abs(n).toFixed(0)) + '', 

   j = ((j = i.length) > 3) ? j % 3 : 0; 
   return sign + (j ? i.substr(0, j) + t : '') + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t); 
};

function get_single_item_at_location( collection, location )
{
  for( var i = 0; i < collection.length; ++i )
  {
    if( location.equals( collection[i].location ) )
    {
      return collection[i];
    }
  }
  
  return null;
}

function get_single_item_ix_by_id( collection, id )
{
  for( var i = 0; i < collection.length; ++i )
  {
    if( collection[i].id == id )
    {
      return i;
    }
  }
  
  return -1;
}

function get_single_item_ix_by_location( collection, location )
{
  for( var ix = 0; ix < collection.length; ++ix )
  {
    if( location.equals( collection[ix].location ) )
    {
      return ix;
    }
  }
  
  return -1;
}

function set_command( value )
{
  $("#command").val( value );
}

function get_command()
{
  return $("#command").val();
}

function set_processing()
{
  $("#processing").val( 1 );
}

function set_finished()
{
  $("#processing").val( 0 );
}

function set_dirty()
{
  document.game.dirty = true;
}

function is_dirty()
{
  return document.game.dirty;
}

function is_processing()
{
  return $("#processing").val() == "1";
}

function convert_raw_coord_to_ix( value )
{
  return Math.floor( parseInt( value ) / TILE_WIDTH );
}

function convert_ix_to_raw_coord( value )
{
  return value * TILE_WIDTH;
}

function convert_tile_ix_to_point( value )
{
  var coord = new Point();
  coord.x = ( value % COMBINED_TILE_COLS ) * TILE_WIDTH;
  coord.y = Math.floor( value / COMBINED_TILE_COLS ) * TILE_WIDTH;

  return coord;
}

function convert_big_tile_ix_to_point( value )
{
  var coord = new Point();
  coord.x = ( value % 3 ) * TILE_WIDTH * 3;
  coord.y = Math.floor( value / 3 ) * TILE_WIDTH * 3;

  return coord;
}

function extend( sub_class, base_class )
{
  function inheritance() { return; }
  inheritance.prototype = base_class.prototype;

  sub_class.prototype = new inheritance();
  sub_class.prototype.constructor = sub_class;
  sub_class.base_constructor = base_class;
  sub_class.super_class = base_class.prototype;
}

function Point( x, y )
{
  Point.base_constructor.call( this );
  
  this.assign = function( point )
  {
    this.x = point.x;
    this.y = point.y;
  };
  
  this.x = 0;
  this.y = 0;
  
  if( y != undefined )
  {
    this.x = x;
    this.y = y;
  }
  else if( x != undefined )
  {
    this.assign( x );    
  }
  
  this.distance_to = function( end )
  {
    return Math.floor( Math.sqrt( Math.pow( this.x - end.x, 2 ) + Math.pow( this.y - end.y, 2 ) ) ); 
  };
  
  this.equals = function( rhs )
  {
    return ( rhs != null && this.x == rhs.x && this.y == rhs.y );   
  };
  
  this.to_string = function()
  {
    return "(" + this.x + ", " + this.y + ")";
  };
  
  this.adjacent_to = function( target )
  {
    return ( Math.abs( this.x - target.x ) <= 1 ) && ( Math.abs( this.y - target.y ) <= 1 ) && !this.equals( target );
  };
  
  this.add_vector = function( vector )
  {
    this.x += vector.x;
    this.y += vector.y;
  };
  
  this.neither_coord_is_zero = function()
  {
    return this.x != 0 && this.y != 0; 
  };
  
  this.invert = function()
  {
    var point = new Point();
    point.x = this.x * -1;
    point.y = this.y * -1;
    
    return point;
  };
  
  this.get_transform_vector = function( point )
  {
    var transform = new Point();
    
    transform.x = point.x - this.x;
    transform.y = point.y - this.y;
    
    return transform;
  };
  
  this.get_unit_vector = function( point )
  {
    var transform = this.get_transform_vector( point );
    
    transform.x = ( transform.x > 0 ) ? 1 : ( transform.x < 0 ) ? -1 : 0;
    transform.y = ( transform.y > 0 ) ? 1 : ( transform.y < 0 ) ? -1 : 0;
    
    return transform;
  };
  
  this.convert_to_raw = function()
  {
    this.x = convert_ix_to_raw_coord( this.x - Map.top_left.x );
    this.y = convert_ix_to_raw_coord( this.y - Map.top_left.y ); 
  };
  
  this.convert_to_raw_tile_center = function()
  {
    this.x = convert_ix_to_raw_coord( this.x - Map.top_left.x ) + ( TILE_WIDTH / 2 );
    this.y = convert_ix_to_raw_coord( this.y - Map.top_left.y ) + ( TILE_WIDTH / 2 ); 
  };
  
  this.convert_to_tile_coord = function()
  {
   this.x = Math.floor( this.x / TILE_WIDTH ) + Map.top_left.x;
   this.y = Math.floor( this.y / TILE_WIDTH ) + Map.top_left.y; 
  };
}
extend( Point, Serializable );

function get_element_by_id( id, collection )
{
  for( var i = 0; i < collection.length; ++i )
  {
    if( collection[i].id == id )
    {
      return collection[i];
    }
  } 
}

function get_element_ix( id, collection )
{
  for( var i = 0; i < collection.length; ++i )
  {
    if( collection[i].id == id )
    {
      return i;
    }
  }
  
  return -1;
}

function chance( pct )
{
  return Math.floor( Math.random() * 100 ) <= pct; 
}

function random_type( max_id )
{
  return Math.floor( Math.random() * max_id ) + 1;
}

function random_index( max_ix )
{
  return Math.floor( Math.random() * max_ix );
}

function GameTime()
{
  this.time = 0;
  this.span = $("#time");
  
  this.update_time = function()
  {
    this.span.text( this.get_time() );
  };
  
  this.add_time = function( secs )
  {
    this.time += secs;
  };
  
  this.get_time = function()
  {
    var time = this.time;
    
    var days = Math.floor( time / 86400 );
    time -= days * 86400;
    
    var hours = Math.floor( time / 3600 );
    time -= hours * 3600;
    
    var mins = Math.floor( time / 60 );
    var secs =  time % 60;
    
    return build_timestamp( days, hours, mins, secs );
  };
  
  function pad_num( num )
  {
    return ( num.length < 2 ) ? "0" + num : num;
  }
  
  function build_timestamp( days, hours, mins, secs )
  {
    var result = "";
    
    hours = pad_num( hours.toString() );
    mins = pad_num( mins.toString() );
    secs = pad_num( secs.toString() );
    
    if( days != 0 )
    {
      result += days + "d,";
    }
    
    if( hours != "00" || result.length > 0 )
    {
      result += hours + ":";
    }
    
    result += mins + ":" + secs;
    
    return result;
  }
}
function Logger()
{
  var div = $("#log");
  var dom = div[0];
  var MAX_LINES = 1000;
  var lines = 0;  
  
  this.add = function( str )
  {
    lines++;
    div.append( "<span>" + str + "<br/></span>" );
    
    this.trim_log();
    
    dom.scrollTop = dom.scrollHeight; 
  };
  
  this.debug = function( str )
  {
    if( DEBUGGING )
    {
      this.add( "<span style=\"color:blue;\">" + str + "</span>" );
    }
  };
  
  this.clear = function()
  {
    lines = 0;
    div.html( "" );
  };
  
  this.trim_log = function()
  {
    if( lines > MAX_LINES )
    {
      div.find("span").first().remove();
      lines = MAX_LINES;
    }
  };

}function DataLoader()
{
  var data = "";
  this.xml = "";
  
  this.initialize = function()
  {
    $.get( "game_data.xml", function( xml ) {
                  data = xml;
                  Loader.process_data();
        }).error( function() { 
            Log.debug( "AJAX error encountered!" ); 
        });
  };
  
  this.process_data = function()
  {
    this.xml = $( data );
    data = null;
    
    Log.debug( "Loading images..." );
    Images.load_tile_images();
    Images.load_spell_images();
    Images.load_monster_images();
    Images.load_item_images();
    Images.load_paperdoll_images();
  };
  
  this.get_data = function( node, id )
  {
    return this.xml.find( node + "[id='" + id + "']" );
  };
  
  this.get_data_by_level = function( node, level )
  {
    return this.xml.find( node + "[level='" + level + "']" );
  };
  
  this.get_spell_data = function( id )
  {
    return this.get_data( "Spell", id );
  };
  
  this.get_monster_data = function( id )
  {
    return this.get_data( "Monster", id );
  };
  
  this.get_monster_quality_for_level = function( xml, level )
  {
    var quality = "";
    
    xml.find("Quality").children().each( function() {
              var $this = $(this);
              var max_level = $this.attr("max_level");
              if( parseInt( $this.attr("min_level") ) <= level && ( max_level == undefined || parseInt( max_level ) >= level ) )
              {
                quality = $this[0].nodeName.toLowerCase();
              }
            });
    
    return quality;
  };
  
  this.get_monsters_suitable_for_level = function( level )
  {
    return this.xml.find("Monster").clone().filter( function() {
                            return Loader.get_monster_quality_for_level( $(this), level ) != "";
                         });
  };
  
  this.get_item_data = function( id )
  {
    return this.get_data( "Item", id );
  };
  
  this.get_widget_data = function( id )
  {
    return this.get_data( "Widget", id );
  };
  
  this.get_trap_data = function( id )
  {
    return this.get_data( "Trap", id );
  };
  
  this.get_status_effect_data = function( id )
  {
    return this.get_data( "StatusEffect", id );
  };
  
  this.get_num_traps = function()
  {
    return this.xml.find("Trap").size();
  };
  
  this.get_texture = function( id )
  {
    return this.get_data( "Texture", id );
  };
  
}function ImageCache()
{
  var need_to_load = 0;
  var loaded = 0;
  var load_bar = $("#load_bar");
  var load_pct = $("#load_pct");
  
  this.TILE_IMAGES = null;
  this.MONSTER_IMAGES = null;
  this.SPELL_IMAGES = null;
  this.BIG_SPELL_IMAGES = null;
  this.ITEM_IMAGES = null;
  this.PAPERDOLL_IMAGES = null;
  
  this.is_loaded = function()
  {
    return loaded == need_to_load && need_to_load > 0; 
  };
  
  function load_single_image( src )
  {
    Log.debug( "Loading image: " + src );
    need_to_load++;
    
    var img = new Image();
    img.onload = function() {
          loaded++;
          Log.debug( "Loading finished: " + this.src + " (" + loaded + "/" + need_to_load + ")" );
          var pct = Math.floor( loaded / need_to_load * 100 );
          load_bar.css( "width", "" + pct + "%" );
          load_pct.html( pct );
        };
    img.src = ""; // Workaround for Chrome
    img.src = "images/" + src;
    
    return img;
  }
  
  function load_images_from_xml( xml, dest, folder )
  {
    if( folder == undefined )
    {
      folder = "";      
    }
    
    xml.each( function(){
      dest.push( load_single_image( folder + "/" + $(this).attr("src") ) );
    });
  }
  
  this.load_tile_images = function()
  {
    this.TILE_IMAGES = load_single_image( "tiles_full.png" );
  };
  
  this.load_spell_images = function()
  {
    this.SPELL_IMAGES = load_single_image( "spells_small.png" );
    this.BIG_SPELL_IMAGES = load_single_image( "spells_big.png" );
  };
 
  this.load_monster_images = function()
  {
    this.MONSTER_IMAGES = load_single_image( "monsters_full.png" );
  };
  
  this.load_item_images = function()
  {
    this.ITEM_IMAGES = load_single_image( "items_full.png" );
  };
  
  this.load_paperdoll_images = function()
  {
    this.PAPERDOLL_IMAGES = load_single_image( "paperdoll_full.png" );
  };
};function Game()
{
  this.ANIMATION_INTERVAL = 50;
  this.interval_loop = null;
  this.widget_loop = null;
  this.animation_queue = new Array();
  this.splat_queue = new Array();
  this.dragging = false;
  this.mouse_start = new Point();
  this.tooltip = new Tooltip();
  this.is_player_move = false;
  this.dirty = false;
  
  var events_bound = false;
  var canvas = null;
  this.map_ctx = null;
  this.buffer = null;
  this.buffer_ctx = null;
  this.spell_buffer = null;
  this.spell_ctx = null;
  var load_div = $("#load_div");

  this.initialize = function()
  {
    Log = new Logger();
    Log.debug( "Initializing..." );

    Time = new GameTime();
    Storage = new GameStorage();
    CustomizeSpellBar = new CustomizeSpellsDialog();
    Dungeon = new DungeonManager();
    NewGame = new NewGameDialog();
    CharInfo = new CharacterInfoDialog();
    StatusEffects = new StatusEffectsManager();
    DrawPlayer = new Paperdoll();
    Inventory = new InventoryManager();
    SpellBar = new SpellToolbar();
    Map = new ViewPort();
    Minimap = new Minimap();
    Loader = new DataLoader();
    Images = new ImageCache();
    
    Loader.initialize();
    disable_toolbars();

    canvas = $("#map");
    
    if( canvas && canvas[0].getContext )
    {
      this.map_ctx = canvas[0].getContext("2d");
      this.buffer = document.createElement("canvas");
      this.buffer.width = canvas[0].width;
      this.buffer.height = canvas[0].height;
      this.buffer_ctx = this.buffer.getContext("2d");
      
      this.spell_buffer = document.createElement("canvas");
      this.spell_buffer.width = canvas[0].width;
      this.spell_buffer.height = canvas[0].height;
      this.spell_ctx = this.spell_buffer.getContext("2d");
      
      return true;
    }
    
    return false;
  };
  
  this.bind_events = function()
  {
    if( !events_bound )
    {
      canvas.on( "mousedown", this.on_mouse_down );
      canvas.on( "mouseup", this.on_mouse_up );
      canvas.on( "mouseleave", this.on_mouse_leave );
      canvas.on( "mousemove", this.on_mouse_move );
      $(document).on( "keydown", this.key_handler );
      $(window).on("beforeunload", function() {
          if( !DEBUGGING && is_dirty() )
          {
            return "Your current game has not been saved!";
          }
          return;
        });
      
      enable_toolbars();
      events_bound = true;
    }
  };

  this.run = function( debug )
  {
    DEBUGGING = debug;
    
    if( this.initialize() )
    {
      this.interval_loop = setInterval( this.wait_for_load_loop, this.ANIMATION_INTERVAL );
      set_processing();
    }
  };
  
  this.create_new_game = function()
  {
    
    Time = new GameTime();
    
    DrawPlayer.construct_paperdoll();
    Player.update_stats();
    Time.update_time();
    
    if( DEBUGGING )
    {
      setup_debug_level();
      this.bind_events();
    }
    else
    {
      Dungeon.levels = [];
      Dungeon.create_level();
      Player.location = Dungeon.levels[0].get_starting_location();
      Dungeon.explore_at_location( Player.location );
    }
    
    SpellBar.update_toolbar();
    Map.center_map_on_location( Player.location );
    Dungeon.update_level();

    document.game.widget_loop = setInterval( this.draw_widgets_loop, this.ANIMATION_INTERVAL );
    
    this.draw();
    set_dirty();
  };
  
  this.wait_for_load_loop = function()
  {
    if( Images.is_loaded() )
    {
      Log.debug( "Done loading!" );
           
      if( DEBUGGING )
      {
        Player = new PlayerActor(); 
        document.game.create_new_game();
        learn_all_spells();
        SpellBar.update_list( get_debug_spellbar() );
        SpellBar.update_toolbar();
      }
      
      clearInterval( document.game.interval_loop );
      document.game.interval_loop = null;
            
      set_finished();
      set_command( NO_COMMAND );
      
      load_div.remove();
      Log.add( "Ready for action!" );
      
      if( !DEBUGGING )
      {
        if( Storage.get_num_saved_games() > 0 )
        {
          Storage.open_load();
        }
        else
        {
          NewGame.open();
        }
      }
    }
  };
  
  this.do_turn = function()
  {
    /*if( Player.is_dead() )    // No more turns if the Player is dead
    {
      return;
    } */
    
    if( this.splat_queue.length > 0 )
    {
      Log.debug( "Processing splats..." );
      this.process_splats();
    }
    else if( this.animation_queue.length == 0 )
    {
      this.is_player_move = false;
      this.update();
    }
    
    Time.update_time();   // Update the game clock
    
    if( !this.is_player_move )
    {
      StatusEffects.run_effects( Time );
    }
    
    this.draw();
    this.draw_spells();
    set_dirty();
  };
  
  this.update = function()
  {
    // MEK TO DO PERFORM ANY NECESSARY LOGIC ROUTINES HERE NOT DIRECTLY ATTACHED TO AN EVENT (I.E. MOVE MONSTERS) 
    Dungeon.move_monsters();
    
    // Heal 1 hit point every minute
    if( Time.time % 60 == 0 )
    {
      Player.heal( 1 );
      Player.update_hp();
    }
  };
  
  this.draw_map = function( ctx )
  {
    var level = Dungeon.get_current_level();

    Map.draw_map( ctx); // First layer: Map tiles, doors, widgets (including stairs) 
    this.draw_collection( level.doors, ctx );
    this.draw_collection( level.stairs_up, ctx );
    this.draw_collection( level.stairs_down, ctx );
    this.draw_collection( level.traps, ctx );
    
    this.draw_collection( level.items, ctx );     // Second layer: Items
    
    this.draw_collection( level.monsters, ctx );  // Third layer: Monsters and Player    
    Player.draw( ctx );
  };
  
  this.draw = function()
  {
    /*if( Player.is_dead() )    // No more drawing if the Player is dead
    {
      return;
    }*/
    
    this.draw_map( this.buffer_ctx );
    this.spell_ctx.drawImage( this.buffer, 0, 0 );  // Backup of map image without any animated elements

    // Draw animated elements
    this.draw_widgets( this.buffer_ctx, false );

    this.map_ctx.drawImage( this.buffer, 0, 0 );
  };
  
  this.draw_collection = function( collection, ctx )
  {
    for( var i = 0; i < collection.length; ++i )
    {
      collection[i].draw( ctx );
    } 
  };

  this.draw_widgets = function( ctx, increment_frame )
  {
    var collection = Dungeon.get_current_level().widgets;

    for( var i = 0; i < collection.length; ++i )
    {
      collection[i].draw( ctx, increment_frame );
    } 
  }
  
  this.key_handler = function( evt )
  {
    evt = ( evt ) ? evt : ( ( window.event ) ? event : null );
  
    if( evt && !is_processing() /*&& !Player.is_dead() */ )
    {
      // Events that can be used on dialogs
      if( evt.keyCode == 84 && ( OPEN_DIALOGS == 0 || Inventory.is_open ) ) // T
      {
        perform_action("take");
        return;
      }
      
      if( OPEN_DIALOGS > 0 )
      {
        return; // Prevent 
      }
      
      // Events that CANNOT be used on dialogs
      switch( evt.keyCode )
      {
        case 36: // numpad 7
        case 38: // up
        case 33: // numpad 9
        case 37: // left
        case 39: // right
        case 35: // numpad 1
        case 40: // down
        case 34: // numpad 3
        case 97: // numlock 1
        case 98: // numlock 2
        case 99: // numlock 3
        case 100: // numlock 4
        case 102: // numlock 6
        case 103: // numlock 7
        case 104: // numlock 8
        case 105: // numlock 9
          if( new Movement().move_on_keypress( evt.keyCode ) )
          {
            document.game.do_turn();
            evt.preventDefault();
          }
          return false;
          break;
        case 27: // esc
          cancel_action();
          break;
        case 49: // 1   SPELL BAR BUTTONS
        case 50: // 2
        case 51: // 3
        case 52: // 4
        case 53: // 5
        case 54: // 6
        case 55: // 7
          cast_spell( evt.keyCode - 49 );
          break;
        case 67: // C
          perform_action( "close" );
          break;
        case 68: // D
          perform_action( "disarm" );
          break;
        case 69: // E
          perform_action( "sleep" );
          break;
        case 73: // I
          Inventory.open();
          break;
        case 77: // M
          Minimap.open();
          break;
        case 79: // O
          perform_action( "open" );
          break;
        case 82: // R
          perform_action( "rest" );
          break;
        case 83: // S
          perform_action( "search" );
          break;
        case 188: // <
          if( evt.shiftKey ) perform_action( "up" );
          break;
        case 190: // >
          if( evt.shiftKey ) perform_action( "down" );
          break;
        default:
          Log.debug( "Unknown key = " + evt.keyCode );
          break;
      }
    }
  };
  
  this.on_mouse_leave = function( evt )
  {
    if( document.game.dragging )
    {
      document.game.end_dragging();
    }
  };
  
  this.on_mouse_down = function( evt )
  {
    if( !is_processing() /*&& !Player.is_dead()*/ )
    {
      var mouse_pos = get_mouse_location( canvas[0], evt );
      
      if( evt.button == 0 && !document.game.tooltip.visible )   // Left-click
      {
        if( Player.location.equals( mouse_pos ) )
        {
          document.game.dragging = true;
          move_cursor();
        }
      }
      else if( evt.button == 2 ) // Right-click
      {
        document.game.tooltip.show_tooltip( mouse_pos );
      }
      
      delete mouse_pos;
    }
    
    return false;
  };
  
  this.on_mouse_up = function( evt )
  {
    if( !is_processing() )
    {
      if( evt.button == 0 && !document.game.tooltip.visible )      
      {
        var mouse_pos = get_mouse_location( canvas[0], evt );
        
        if( document.game.dragging )
        {
          document.game.end_dragging();
        }

        if( process_click( mouse_pos ) )
        {
          document.game.is_player_move = true;
          document.game.do_turn();
        }
        
        Log.debug( "Clicked on " + mouse_pos.to_string() );
        //Log.debug( JSON.stringify( Dungeon.get_current_level().map_tiles[mouse_pos.y][mouse_pos.x] ) );
      }
      else if( evt.button == 2 ) // Right-click
      {
        document.game.tooltip.hide_tooltip(); 
      }
    }
    
    return false;
  };
  
  this.end_dragging = function()
  {
    document.game.dragging = false;
    default_cursor();
    
    if( document.game.animation_queue.length == 0 )
    {
      Map.center_map_on_location( Player.location );
      document.game.draw();
    }
    
    //Log.debug( "End dragging." );
  };
  
  this.on_mouse_move = function( evt )
  {
    if( !is_processing() && document.game.dragging )
    {
      //Log.debug( "Dragging player..." ); 
      var mouse_pos = get_mouse_location_for_dragging( canvas[0], evt );
      
      if( !Player.location.equals( mouse_pos ) )
      {
        var vector = Player.location.get_unit_vector( mouse_pos );
        
        if( Map.is_valid_move( Player.location, vector ) )
        {
          var move = new Movement();
          var valid = move.move_actor_with_vector( Player, vector );
  
          if( valid )
          {
            Time.add_time( TIME_STANDARD_MOVE );
            document.game.do_turn();
            
            if( Map.is_location_on_an_edge( Player.location ) || document.game.animation_queue.length > 0 )
            {
              document.game.end_dragging();
            }
          }
        }
      }
    }
    
    return false;
  };
  
  this.draw_spells = function()
  {
    if( this.animation_queue.length > 0 )
    {
      set_processing();
      document.game.interval_loop = setInterval( this.draw_spells_interval_loop, this.ANIMATION_INTERVAL );
    }
  };

  this.draw_widgets_loop = function()
  {
    if( !is_processing() && OPEN_DIALOGS == 0 )
    {
      document.game.buffer_ctx.drawImage( document.game.spell_buffer, 0, 0 );
      document.game.draw_widgets( document.game.buffer_ctx, true );
      document.game.map_ctx.drawImage( document.game.buffer, 0, 0 );
    }
  };
  
  this.draw_spells_interval_loop = function()
  {
    //Log.debug( "Running spell animation interval..." );
    document.game.buffer_ctx.drawImage( document.game.spell_buffer, 0, 0 );    // Draw the backup of the map without any animated effects.

    // Draw animated elements
    document.game.draw_widgets( document.game.buffer_ctx, true );
    draw_spells_for_interval( document.game.buffer_ctx );

    document.game.map_ctx.drawImage( document.game.buffer, 0, 0 );
    
    if( document.game.animation_queue.length == 0 && document.game.is_player_move )
    {
      stop_animations();
      document.game.do_turn();
    }
    else
    { 
      // If the animation queue is empty, but we have some splats queued up, add them to the animation queue.
      if( document.game.animation_queue.length == 0 && document.game.splat_queue.length > 0 )
      {
        document.game.draw();
        document.game.spell_ctx.drawImage( canvas[0], 0, 0 );   // Make sure we refresh the spell buffer to remove any dead monsters!
        document.game.process_splats();
      }
      
      // If all animations are done (no more splats), clean everything up.
      if( document.game.animation_queue.length == 0 )
      {
        stop_animations(); 
        Map.center_map_on_location( Player.location );
        document.game.draw();
      }
    }
  };
  
  this.add_splat = function( target )
  {
    this.splat_queue.push( target ); 
  };
  
  this.process_splats = function()
  {
    for( var x = 0; x < this.splat_queue.length; x++ )
    {
      add_spell_effect( new SinglePointRotatingFadingSpellEffect( SPLAT, this.splat_queue[x] ) ); 
    }
    
    this.splat_queue = new Array();
  };
};

function stop_animations()
{
  window.clearInterval( document.game.interval_loop );
  document.game.interval_loop = null;
  set_finished();
  set_command( NO_COMMAND );
}

function disable_toolbars()
{
  $("#verbs_bar button").prop("disabled", "disabled");
  $("#spell_bar button").prop("disabled", "disabled");
  $("#save_game").hide();
}

function enable_toolbars()
{
  $("#verbs_bar button").prop("disabled", "");
  $("#spell_bar button").prop("disabled", "");
  $("#save_game").show();
}function Tooltip()
{
  this.tooltip = $("#tooltip");
  this.header = $("#tooltip_header");
  this.contents = $("#tooltip_contents");
  this.map_location = $("#map").position();
  this.num_items = 0;
  this.visible = false;
  this.has_los = false;
  var TOOLTIP_FADE_SPEED = 150;

  this.tooltip.hide();
  
  this.show_tooltip = function( location )
  {
    this.num_items = 0;
    this.visible = true;
    this.has_los = Map.does_line_of_sight_exist( Player.location, location );
    
    this.contents.empty();
    this.fill_content( location );
    this.fill_header( location );    
    
    this.adjust_position( location );
    this.tooltip.stop( true, true ).fadeIn( TOOLTIP_FADE_SPEED ); 
  };
  
  this.hide_tooltip = function()
  {
    this.tooltip.fadeOut( TOOLTIP_FADE_SPEED );
    this.visible = false;
  };
  
  this.adjust_position = function( location )
  {
    // TODO FANCIER WAY OF SETTING THE LOCATION IN CASE WE GO OFF THE EDGE OF THE WINDOW
    location.convert_to_raw();
    this.tooltip.css( "top", parseInt( location.y ) + this.map_location.top + TILE_WIDTH );
    this.tooltip.css( "left", location.x + this.map_location.left );
  };
  
  this.fill_content = function( location )
  {
    if( ( this.has_los && ( Dungeon.is_location_lit( location ) || Player.location.adjacent_to( location ) ) ) || DETECT_MONSTERS )
    { 
      this.fill_tooltip_with_single_object( Dungeon.get_monster_in_tile( location ) );
    }
    
    if( Dungeon.is_location_explored( location ) )
    {
      this.fill_tooltip_with_single_object( Dungeon.get_door_in_tile( location ) );
      this.fill_tooltip_with_widgets( location );
      this.fill_tooltip_with_items( location );
    }
  };
  
  this.fill_tooltip_with_single_object = function( obj )
  {
    if( obj != null )
    {
      var text = obj.get_tooltip();
      
      if( text != "" )
      {
        this.contents.append( obj.get_tooltip() );
        this.num_items++;
      }
    }
  };
    
  this.fill_tooltip_with_items = function( location )
  {
    var floor_items = Dungeon.get_items_in_tile( location );
    
    for( var i = 0; i < floor_items.length; ++i )
    {
      this.contents.append( floor_items[i].get_tooltip() );
    }
    
    this.num_items += floor_items.length;
    floor_items = [];
  };
  
  this.fill_tooltip_with_widgets = function( location )
  {
    var level = Dungeon.get_current_level();
    
    this.fill_tooltip_from_collection( level.stairs_up, location );
    this.fill_tooltip_from_collection( level.stairs_down, location );
    this.fill_tooltip_from_collection( level.traps, location );
    this.fill_tooltip_from_collection( level.widgets, location );
  };
  
  this.fill_tooltip_from_collection = function( collection, location )
  {
    this.fill_tooltip_with_single_object( get_single_item_at_location( collection, location ) );
  };
  
  this.fill_header = function( location )
  {
    var str = "";
    
    if( this.num_items > 0 )
    {
      if( this.has_los )
      {
        str = "You see:";
      }
      else if( DETECT_MONSTERS )
      {
        str = "You detect:";
      }
      else
      {
        str = "Your map shows:";
      }
    }
    else
    {
      if( Dungeon.is_location_explored( location ) )
      {
        if( this.has_los )
        {
          if( Dungeon.is_location_lit( location ) || Player.location.adjacent_to( location ) )
          {
            str = "You see nothing.";
          }
          else
          {
            str = "It is too dark to see that!";
          }
        }
        else
        {
          str = "Your map shows nothing.";
        }
      }
      else
      {
        str = "You haven't seen that location!";
      }
    }
    
    this.header.text( str );
  };
};


function Tile( ix )
{
  Tile.base_constructor.call( this );
  this.tile_ix   = ix;
  this.passable  = false;
  this.explored  = false;
  this.is_lit    = false;
  this.room_id   = -1;
  this.is_entrance = false;
  
  this.is_lit_room = function()
  {
    return this.is_lit && this.room_id != -1;
  };
  
  this.is_darkened = function()
  {
    return this.passable && !this.is_lit;
  };
  
  this.is_lit_unexplored = function()
  {
    return this.is_lit && !this.explored;
  };
  
  this.is_a_room = function()
  {
    return this.room_id != -1;
  };
};
extend( Tile, Serializable );

function ViewPort()
{
  this.top_left  = new Point( 0, 0 );
    
  this.draw_map = function( ctx )
  {
    ctx.save();
 
    for( var row = 0; row < VIEWPORT_HEIGHT; ++row )
    {
      for( var col = 0; col < VIEWPORT_WIDTH; ++col )
      {
        this.draw_single_tile( row, col, ctx );
      }
    }
    
    ctx.restore();
  };
  
  this.draw_single_tile = function( row, col, ctx, force_draw )
  {
    var map_tiles = Dungeon.get_map_tiles();
    
    if( this.top_left.y + row >= map_tiles.length || this.top_left.x + col >= map_tiles[0].length )
    {
      return;
    }
    
    var tile = map_tiles[this.top_left.y + row][this.top_left.x + col];
    var canvas_x = convert_ix_to_raw_coord( col );
    var canvas_y = convert_ix_to_raw_coord( row );
        
    if( tile.explored || force_draw != undefined )
    {
      var img_loc = convert_tile_ix_to_point( tile.tile_ix );
      ctx.drawImage( Images.TILE_IMAGES, img_loc.x, img_loc.y, TILE_WIDTH, TILE_WIDTH, canvas_x, canvas_y, TILE_WIDTH, TILE_WIDTH );
      
      if( tile.is_darkened() )
      {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect( canvas_x, canvas_y, TILE_WIDTH, TILE_WIDTH );
      }
    }
    else
    {
      ctx.fillStyle = "rgb(255,255,255)";
      ctx.fillRect( canvas_x, canvas_y, TILE_WIDTH, TILE_WIDTH );
    }
  };
  
  this.is_valid_move = function( point, vector )
  {
    var new_pos = new Point( point.x, point.y );
    
    if( vector != undefined )
    {
      new_pos.add_vector( vector );
    }
    
    if( this.is_location_visible( new_pos ) ) 
    {
      return this.is_location_passable( new_pos );
    }
    
    return false;
  };
  
  this.is_location_passable = function( location )
  {
    var map_tiles = Dungeon.get_map_tiles();
    
    if( map_tiles[location.y][location.x].passable )
    {
      if( map_tiles[location.y][location.x].is_entrance )
      {
        // Can't go through secret doors that have not been found yet
        var door = Dungeon.get_door_in_tile( location );
        if( door && !door.is_visible() )
        {
          return false;
        }
      }

      // Some widgets cannot be stepped on
      var widget = Dungeon.get_widget_in_tile( location );
      if( widget && !widget.passable )
      {
        return false;
      }
      
      return true;
    }
    
    return false;
  };
  
  this.is_location_transparent = function( location )
  {
    if( Dungeon.get_map_tiles()[location.y][location.x].passable )
    {
      // Can't see through closed doors
      var door = Dungeon.get_door_in_tile( location );
      if( door && !door.is_open() )
      {
        return false;
      }
      
      return true;
    }
    
    return false;
  };
  
  this.is_location_inbounds = function ( point )
  {
    var map_tiles = Dungeon.get_map_tiles();

    return point.x >= 0 && point.y >= 0 && point.x < map_tiles[0].length && point.y < map_tiles.length;
  };
  
  this.is_location_visible = function( point )
  {
    return ( point.x >= this.top_left.x )
            && ( point.y >= this.top_left.y )
            && ( point.x < this.top_left.x + VIEWPORT_WIDTH )
            && ( point.y < this.top_left.y + VIEWPORT_HEIGHT );
  };
  
  this.translate_map_coord_to_viewport = function( map_coord )
  {
    var view_coord = new Point( map_coord.x, map_coord.y );
    view_coord.x -= this.top_left.x;
    view_coord.y -= this.top_left.y;
    
    return view_coord;
  };
  
  this.center_map_on_location = function( center )
  {
    var new_corner = new Point();
    var map_tiles = Dungeon.get_map_tiles();
    
    new_corner.x = Math.max( 0, center.x - Math.floor( VIEWPORT_WIDTH / 2 ) );
    new_corner.y = Math.max( 0, center.y - Math.floor( VIEWPORT_HEIGHT / 2 ) );
    
    if( new_corner.x > map_tiles[0].length - VIEWPORT_WIDTH )
    {
      new_corner.x = map_tiles[0].length - VIEWPORT_WIDTH; 
    }
    
    if( new_corner.y > map_tiles.length - VIEWPORT_HEIGHT )
    {
      new_corner.y = map_tiles.length - VIEWPORT_HEIGHT; 
    }
    
    //Log.debug( "Adjusting map corner to " + new_corner.to_string() );
    this.top_left.assign( new_corner );
  };
  
  this.is_location_on_an_edge = function( location )
  {
    var to_return = false;
    var view_pos = this.translate_map_coord_to_viewport( location );
    
    if( view_pos.x == 0 || view_pos.y == 0 || view_pos.x == VIEWPORT_WIDTH - 1 || view_pos.y == VIEWPORT_HEIGHT - 1 )
    {
      to_return = true;
    }
    
    delete view_pos;
    return to_return;
  };
  
  this.does_line_of_sight_exist = function( start, end )
  {
    if( start.equals( end ) )
    {
      return true;
    }
    
    var to_return = true;
    var raw_start = new Point( start.x, start.y );
    var raw_end   = new Point( end.x, end.y );
    var current_tile = new Point();
    var last_tile = new Point( -1, -1 );
    raw_start.convert_to_raw_tile_center();
    raw_end.convert_to_raw_tile_center();
    
    var steps    = Math.floor( raw_start.distance_to( raw_end ) / 5 ); // Check every 5 pixels
    var slope_x  = ( raw_end.x - raw_start.x ) / steps;
    var slope_y  = ( raw_end.y - raw_start.y ) / steps;
    
    for( var ix = 0; ix <= steps; ix++ )
    {
      raw_start.x += slope_x;
      raw_start.y += slope_y;
      
      current_tile.x = raw_start.x;
      current_tile.y = raw_start.y;
      current_tile.convert_to_tile_coord();
      
      if( !current_tile.equals( last_tile ) )
      {
        if( !this.is_location_transparent( current_tile ) && !current_tile.equals( end ) )
        {
          to_return = false;
          break;
        }
        else
        {
          last_tile.assign( current_tile );
        }
      }
    }
    
    return to_return;
  };
  
  this.get_target_item_in_tile = function( target )
  {
    if( target.equals( Player.location ) )
    {
      return Player;
    }
    
    var target_item = Dungeon.get_monster_in_tile( target );
    
    if( target_item == null && Dungeon.get_map_tiles()[target.y][target.x].is_entrance )    // No monster, try looking for a door
    {
      target_item = Dungeon.get_door_in_tile( target );
      
      if( target_item && ( !target_item.is_visible() || target_item.is_broken() ) )
      {
        target_item = null;   // Broken and secret doors cannot be targetted by anything
      }
    }

    return target_item;    
  };
};
function Actor( id )
{
  Actor.base_constructor.call( this );
  this.id           = id;
  this.description  = "You";
  this.img_id       = 0;
  this.location     = new Point();
  this.max_hp       = 0;
  this.max_mana     = 0;
  this.current_hp   = 0;
  this.current_mana = 0;
  this.ac           = 0;
  this.sight        = 100;
  this.melee_damage = 2;
  
  this.is_monster   = false;
  this.spell        = -1;
}
extend( Actor, Serializable );

Actor.prototype.initialize = function()
{
  this.current_hp   = this.max_hp;
  this.current_mana = this.max_mana;
};

Actor.prototype.load = function( obj )
{
  Actor.super_class.load.call( this, obj );
  this.location = Storage.load_point( obj.location );
};

Actor.prototype.draw = function( ctx )
{
  if( this.should_draw_actor() )
  {
    var view_pos = Map.translate_map_coord_to_viewport( this.location );
    
    if( Dungeon.is_location_lit_unexplored( this.location ) )
    {
      Map.draw_single_tile( view_pos.y, view_pos.x, ctx, true );
    }
    
    var img_loc = convert_tile_ix_to_point( this.img_id );
    ctx.drawImage( Images.MONSTER_IMAGES, img_loc.x, img_loc.y, TILE_WIDTH, TILE_WIDTH, convert_ix_to_raw_coord( view_pos.x ), convert_ix_to_raw_coord( view_pos.y ), TILE_WIDTH, TILE_WIDTH );
  }   
};

Actor.prototype.should_draw_actor = function()
{
  // Draw Actor if:
  //  - its location is in the viewport
  //  - it is on a lit tile OR directly adjacent to the Player
  //  - line of sight exists (leave to the end since it is the most expensive check)
  return DETECT_MONSTERS || 
         ( Map.is_location_visible( this.location )
      && ( Dungeon.is_location_lit( this.location ) || this.location.adjacent_to( Player.location ) ) 
      && Map.does_line_of_sight_exist( Player.location, this.location ) );
};

Actor.prototype.heal = function( value )
{
  this.current_hp += value;
  if( this.current_hp > this.max_hp )
  {
    this.current_hp = this.max_hp; 
  }
};

Actor.prototype.damage = function( value )
{
  this.current_hp -= value;
  Log.debug( this.description + " has " + this.current_hp + " hp remaining." );
};

Actor.prototype.is_dead = function()
{
  return this.current_hp <= 0;
};

Actor.prototype.would_damage_kill_actor = function( value )
{
  return ( this.current_hp - value ) <= 0; 
};

Actor.prototype.regen_mana = function( value )
{
  this.current_mana += value;
  if( this.current_mana > this.max_mana )
  {
    this.current_mana = this.max_mana; 
  }
};

Actor.prototype.use_mana = function( value )
{
  this.current_mana -= value;
};
  
Actor.prototype.get_health_term = function()
{
  var health_pct = Math.floor( this.current_hp / this.max_hp * 100 );
  
  if( health_pct == 100 )
  {
    return "a healthy"; 
  }
  else if( health_pct >= 80 )
  {
    return "a slightly injured"; 
  }
  else if( health_pct >= 60 )
  {
    return "a moderately injured"; 
  }
  else if( health_pct >= 40 )
  {
    return "an injured"; 
  }
  else if( health_pct >= 20 )
  {
    return "a seriously injured"; 
  }
  else
  {
    return "a critically injured"; 
  }
};

Actor.prototype.move_to = function( location )
{
  this.location.assign( location );
};

Actor.prototype.add_vector = function( vector )
{
  this.location.add_vector( vector );
};

Actor.prototype.get_melee_damage = function()
{
  // TODO incorporate inventory here
  return this.melee_damage;
};

var STR = 0;
var INT = 1;
var DEX = 2;
var CON = 3;
var NUM_STATS = 4;

function PlayerActor()
{
  PlayerActor.base_constructor.call( this, "man" );
  PlayerActor.super_class.initialize.call( this );
  
  this.bag = new Array();
  this.spellbook = new Array();
  this.level = 1;
  this.xp    = 12345;  // TODO TEMP VALUE
  this.ac    = 100;    // TODO TEMP VALUE
  this.stats = [ new CharStat(), new CharStat(), new CharStat(), new CharStat() ];
    
  // TODO: THESE ARE TEMPORARY SETTINGS
  this.max_hp = 10;
  this.current_hp = this.max_hp;
  this.max_mana = 15;
  this.current_mana = this.max_mana;
  // TODO END TEMPORARY
  
  this.draw = function( ctx )
  {
    DrawPlayer.draw( ctx );
  };
  
  this.damage = function( value )
  {
    PlayerActor.super_class.damage.call( this, value );
    this.update_hp();
  };
  
  this.update_stats = function()
  {
    this.update_hp();
    this.update_mana();
  };
  
  this.update_hp = function( id )
  {
    var div = "#" + ( id == undefined ? "hp" : id );
    
    $(div).text( this.current_hp + "/" + this.max_hp );
    $(div).css( "color", ( this.current_hp / this.max_hp ) <= 0.25 ? "red" : "#333" );
  };
  
  this.update_mana = function( id )
  {
    $("#" + ( id == undefined ? "mana" : id )).text( this.current_mana + "/" + this.max_mana );
  };
  
  function get_main_stat_ix( stat )
  {
    if( stat == "str" )
      return STR;
    if( stat == "int" )
      return INT;
    else if( stat == "dex" )
      return DEX;
    else if( stat == "con" )
      return CON;
    else
    {
      Log.debug( "Invalid stat requested: " + stat );
      return NUM_STATS; // Error case
    }
  }
  
  function apply_single_stat_change( actor, stat, value, callback )
  {
    var stat_ix = get_main_stat_ix( stat );
    
    if( stat_ix != NUM_STATS )
    {
      actor.stats[stat_ix].current_value = callback( actor.stats[stat_ix].current_value, value );
      // TODO LIKELY NEED TO MAKE SOME CHANGES HERE TO HANDLE MAX STAT CHANGING (I.E FOR CURSES )
    }
  }
  
  function apply_stat_changes( actor, xml, callback )
  {
    xml.children().each( function() {
      var $this = $(this);
      var stat = $this[0].nodeName.toLowerCase();
      var value = parseInt( $this.text() );
      apply_single_stat_change( actor, stat, value, callback );
    });
  }
  
  this.apply_effect = function( xml )
  {
    apply_stat_changes( this, xml, add_stat );
  };
  
  this.remove_effect = function( xml )
  {
    apply_stat_changes( this, xml, remove_stat );
  };
}
extend( PlayerActor, Actor );

function add_stat   ( a, b ) { return a + b; }
function remove_stat( a, b ) { return a - b; }

PlayerActor.prototype.load = function( obj )
{
  PlayerActor.super_class.load.call( this, obj );
  this.bag = Storage.load_collection( obj.bag, Item );
};

function CharStat()
{
  this.current_value = 0;  // Current value (base stat +/- effects)
  this.base_value    = 0;  // Base stat (remains constant except when levelling up)
}

function process_click( location )
{
  if( is_processing() || location.equals( Player.location ) ) // Don't allow clicks if we're already processing an event.
  {
    return false;
  }
  
  set_processing();
  var command = get_command();
  var valid_action = false;
  
  if( command == "0" )
  {
    var target_item = Map.get_target_item_in_tile( location );
    
    if( location.adjacent_to( Player.location ) && target_item != null && target_item.is_monster )
    {
      Time.add_time( TIME_STANDARD_MOVE );
      new Melee( Player, target_item ).process();
      valid_action = true;
    }
    
    set_finished();      
  }
  else
  {
    if( is_action( command ) )
    {
      valid_action = handle_action( command, location );
    }
    else if( create_spell( command, Player, location ) )
    {
      Time.add_time( TIME_STANDARD_MOVE );
      Player.update_mana();
      valid_action = true; 
    }
    else
    {
      set_finished();
    }
  }
  
  cancel_action();

  return valid_action;
}

function get_raw_mouse_location( canvas, event )
{
  var canoffset = $(canvas).offset();
  var x = event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft - Math.floor(canoffset.left);
  var y = event.clientY + document.body.scrollTop + document.documentElement.scrollTop - Math.floor(canoffset.top) + 1;
  
  return new Point( x, y );
}

function get_mouse_location( canvas, event )
{
  var location = get_raw_mouse_location( canvas, event );
  location.convert_to_tile_coord();
  
  //Log.debug( "Clicked on raw coord (" + x + ", " + y + ") and converted to tile coord " + location.to_string() );
  return location;
}

function get_mouse_location_for_dragging( canvas, event )
{
  var actual_pos = get_raw_mouse_location( canvas, event );
  var tile_center = new Point( actual_pos.x, actual_pos.y );
  tile_center.convert_to_tile_coord();
  tile_center.convert_to_raw_tile_center();
  
  if( actual_pos.distance_to( tile_center ) <= TILE_DRAG_BUFFER )
  {
    tile_center.convert_to_tile_coord();
    return tile_center;
  }
  
  return Player.location;
}

function crosshairs_cursor()
{
  document.getElementById("map").style.cursor = "crosshair";
}

function default_cursor()
{
  document.getElementById("map").style.cursor = "";
}

function move_cursor()
{
  document.getElementById("map").style.cursor = "move";
}function Movement()
{
  this.get_vector_for_keypress = function( key )
  {
    var vector = null;
    
    switch( key )
    {
      case 36:  // numpad 7
      case 103:
        vector = new Point( -1, -1 );
        break;
      case 38:  // up
      case 104:
        vector = new Point( 0, -1 );
        break;
      case 33:  // numpad 9
      case 105:
        vector = new Point( 1, -1 );
        break;    
      case 37: // left
      case 100:
        vector = new Point( -1, 0 );
        break;    
      case 39: // right
      case 102:
        vector = new Point( 1, 0 );
        break;
      case 35:  // numpad 1
      case 97:
        vector = new Point( -1, 1 );
        break; 
      case 40:  // down
      case 98:
        vector = new Point( 0, 1 );
        break;
      case 34:  // numpad 3
      case 99:
        vector = new Point( 1, 1 );
        break;
    }
    
    return vector;
  };
  
  this.move_on_keypress = function( key )
  {
    var vector = this.get_vector_for_keypress( key );
    var success = this.move_actor_with_vector( Player, vector );
        
    if( !document.game.dragging )
    {
      Map.center_map_on_location( Player.location );
    }
    
    return success;
  };
  
  this.move_actor_with_vector = function( actor, vector )
  {
    if( Map.is_valid_move( actor.location, vector ) )
    {
      if( !actor.is_monster )
      {
        Time.add_time( TIME_STANDARD_MOVE ); 
      }
      
      var target = new Point( actor.location.x, actor.location.y );
      target.add_vector( vector );
      var target_item = Map.get_target_item_in_tile( target );
      
      if( target_item )
      {
        if( ( actor.is_monster || !document.game.dragging ) && this.is_valid_target_for_melee( actor, target_item ) )
        {
          // Monsters can hit us if we drag past them, but don't allow the Player to drag into a monster
          var melee_attack = new Melee( actor, target_item );
          melee_attack.process();
          return true;
        }
        else if( target_item.is_door )
        {
          if( !target_item.is_open() )
          {
            target_item.set_open();
          }
          
          apply_vector_to_actor( actor, vector );
          return true;
        }
      }
      else
      {
        apply_vector_to_actor( actor, vector );
        return true;
      }
    }
    
    return false;
  };
  
  this.is_valid_target_for_melee = function( actor, target_item )
  {
    return actor != target_item && !( actor.is_monster && target_item.is_monster ) && !target_item.is_door; 
  };
  
  function apply_vector_to_actor( actor, vector )
  {
    actor.add_vector( vector );
        
    if( !actor.is_monster )
    {
      Dungeon.explore_at_location( actor.location );
      Dungeon.trigger_traps_in_tile( actor.location );
    }
  }
}var BEHAVE_AGGRESSIVE = 0;
var BEHAVE_PASSIVE    = 1;
var BEHAVE_INERT      = 2;

function Monster( type )
{
  Monster.base_constructor.call( this, Monster.max_monster_id );
  Monster.max_monster_id++;
  
  this.type       = type;
  this.is_monster = true;
  this.img_id     = type;
  
  this.load_from_xml();
  Monster.super_class.initialize.call( this );
}
extend( Monster, Actor );

Monster.max_monster_id = 0;

Monster.prototype.load_from_xml = function()
{
  var xml = Loader.get_monster_data( this.type );
  
  this.description = xml.find("Description").text();
  this.max_hp      = xml.find("HP").text();
  this.max_mana    = xml.find("Mana").text();
  this.ac          = xml.find("AC").text();
  this.sight       = xml.find("Sight").text();
  this.melee_damage= xml.find("Melee").text();
  this.spell       = xml.find("SpellCast").attr("id");
  this.behave      = parseInt( xml.find("Behave").text() );
  
  if( this.spell == "" )
  {
    this.spell = undefined;    
  }
  
  if( isNaN( this.behave ) )
  {
    this.behave = chance( 50 ) ? BEHAVE_AGGRESSIVE : BEHAVE_PASSIVE;
  }
};

Monster.prototype.become_aggressive = function()
{
  if( this.behave != BEHAVE_INERT )
  {
    this.behave = BEHAVE_AGGRESSIVE;
  }
};

Monster.prototype.damage = function( value )
{
  Monster.super_class.damage.call( this, value );
  this.become_aggressive();
  
  if( this.current_hp <= 0 )
  {
    this.kill(); 
  }
};

Monster.prototype.kill = function()
{
  Log.add( "The " + this.description + " is dead." );
  
  document.game.add_splat( this.location );
  
  Dungeon.kill_monster( this.id );
  StatusEffects.remove_effects_for_target( this.id );
    
  // TODO DROP LOOT, GIVE XP, BLAH BLAH BLAH  
};

Monster.prototype.get_tooltip = function()
{
  var html = "<li>" + this.get_health_term() + " " + this.description;
  
  if( DEBUGGING )
  {
    html += " (id=" + this.id + ", behave=" + this.behave + ")";
  }
  html += "</li>";
  
  return html;
};

Monster.prototype.is_location_within_sight = function( target )
{
  return ( Math.floor( this.location.distance_to( target ) ) <= this.sight );
};

Monster.prototype.do_move = function()
{
  if( Map.is_location_visible( this.location ) )
  {
    var vector = null;
    
    if( this.is_location_within_sight( Player.location ) && Map.does_line_of_sight_exist( this.location, Player.location ) )
    {
      var is_adjacent = this.location.adjacent_to( Player.location );
      
      // Monsters that can cast spells have a 50% chance to cast it at the Player instead of moving if they are not adjacent to the player
      if( this.spell != undefined && !is_adjacent && MONSTER_SPELLS && this.behave == BEHAVE_AGGRESSIVE && chance( 50 ) )
      {
        create_spell( this.spell, this, Player.location );
      }
      else if( this.spell != undefined && is_adjacent && MONSTER_SPELLS && this.behave == BEHAVE_INERT && chance( 50 ) )
      {
        // Inert monsters have a spell attack against adjacent Players
        Log.add( "The " + this.description + " lashes out with a hideous appendage!" );
        create_spell( this.spell, this, Player.location );
      }
      else if( this.behave == BEHAVE_AGGRESSIVE || is_adjacent )
      {
        // Aggressive monsters move to attack.
        // Passive/inert only attack when something is adjacent
        this.become_aggressive();
        vector = this.location.get_unit_vector( Player.location );
      }
    }
    else if( chance( 50 ) && this.behave != BEHAVE_INERT )   // 50% chance of wandering randomly if they cannot see the player.
    {
      //Log.debug( "Monster " + this.id + " doesn't see Player and wanders aimlessly." );
      var vector = new Point();
      vector.x += Math.floor( Math.random() * 3 ) - 1;
      vector.y += Math.floor( Math.random() * 3 ) - 1;
    }
    
    if( vector )
    {
      var move = new Movement().move_actor_with_vector( this, vector );
    }
  }
  else
  {
    //Log.debug( "Monster " + this.id + " not visible. Not moving." ); 
  }
};function Melee( source, target )
{
  this.source = source;
  this.target = target;
  
  this.process = function()
  {
    var attack_roll = this.generate_attack_roll();
    
    Log.debug( "Attack roll = " + attack_roll );
    
    if( attack_roll == 20 )
    {
      this.process_critical_hit();
    }
    else if( attack_roll >= this.target.ac )
    { 
      this.process_regular_hit();
    }
    else
    {
      this.process_miss();
    }
  };
   
  this.generate_attack_roll = function()
  {
     // TODO incorporate buffs from player.
    return Math.floor( Math.random() * 20 + 1 );      // d20 roll
  };
  
  this.show_kill_message_if_necessary = function( damage )
  {
    if( this.target.would_damage_kill_actor( damage ) )
    {
      if( this.source.is_monster )
      {
        Log.add( "The " + this.source.description + " dealt you a mortal strike!" );
      }
      else
      {
        Log.add( "You slice into the " + this.target.description + ", spraying viscera everywhere!" );
      }
    }
  };
  
  this.process_critical_hit = function()
  {
    var damage = this.source.get_melee_damage() * 2;
    
    // TODO ADD SOME RANDOMIZED FLAVOUR TEXT?
    if( this.source.is_monster )
    {
      Log.add( "The " + this.source.description + " hits you in a vital location!" );
    }
    else
    {
      Log.add( "You hit the " + this.target.description + " in a vital location!" );
    }
    
    this.show_kill_message_if_necessary( damage );
    this.target.damage( damage );
  };
  
  this.process_regular_hit = function()
  {
    // TODO ADD SOME RANDOMIZED FLAVOUR TEXT?
    if( this.source.is_monster )
    {
      Log.add( "The " + this.source.description + " swings and hits you with a solid blow!" );
    }
    else
    {
      Log.add( "You swing and deal a solid blow to the " + this.target.description + "!" );
    }
    
    this.show_kill_message_if_necessary( this.source.get_melee_damage() );
    this.target.damage( this.source.get_melee_damage() );
  };
  
  this.process_miss = function()
  {
    // TODO ADD SOME RANDOMIZED FLAVOUR TEXT?
    if( this.source.is_monster )
    {
      Log.add( "The " + this.source.description + " misses you with a wild swing!" );
    }
    else
    {
      Log.add( "You swing wildly at the " + this.target.description + " and miss!" );
    }
  };
}var SPELL_WIDTH = 12;
var AREA_SPELL_WIDTH = TILE_WIDTH * 3;
var SPELL_BUTTONS = 7;

function SpellToolbar()
{
  SpellToolbar.base_constructor.call( this );
  this.spell_list = [];
  
  this.update_list = function( spells )
  {
    this.spell_list = [];

    for( var ix = 0; ix < spells.length; ++ix )
    {
      this.spell_list.push( spells[ix] );
    }
    
    for( var ix = SPELL_BUTTONS - this.spell_list.length - 1; ix < SPELL_BUTTONS; ++ix )
    {
      this.spell_list.push( "" );
    }
  };
  
  this.update_toolbar = function()
  {
    for( var ix = 0; ix < this.spell_list.length; ++ix )
    {
      var spell_btn = $("#spell"+ix);
      var html = "<canvas width=\"" + TILE_WIDTH + "\" height=\"" + TILE_WIDTH + "\"></canvas>";
      var title = "";
      var xml = null;
      var toolbar_img = null;
      
      spell_btn.removeClass("active");
      
      if( this.spell_list[ix] != "" )
      {
        xml = Loader.get_spell_data( this.spell_list[ix] );
        toolbar_img = parseInt( xml.attr("toolbar_id") );
      }
      
      if( toolbar_img != null )
      {
        title = ( ix + 1 ) + " - " + xml.find("Description").text();
      }
      else
      {
        spell_btn.button("toggle");
      }
      
      spell_btn.empty().html( html ).attr( "title", title );

      if( toolbar_img != null )
      {
        var ctx = spell_btn.find("canvas")[0].getContext("2d");
        var img_loc = convert_tile_ix_to_point( toolbar_img );
        ctx.drawImage( Images.SPELL_IMAGES, img_loc.x, img_loc.y, TILE_WIDTH, TILE_WIDTH, 0, 0, TILE_WIDTH, TILE_WIDTH );
      }
    }
  };
  
  this.get_button_ix = function( spell_id )
  {
    for( var ix = 0; ix < this.spell_list.length; ++ix )
    {
      if( this.spell_list[ix] == spell_id )
        return ix;
    }
    
    return -1;
  };
}
extend( SpellToolbar, Serializable );

function cast_spell( btn_ix )
{
  if( !is_processing() && SpellBar.spell_list[btn_ix] != "" && SpellBar.spell_list[btn_ix] != undefined  )
  {
    if( get_command() != NO_COMMAND )
    {      
      cancel_action();
    }
	  
    var spell_id =  SpellBar.spell_list[btn_ix];
    var xml = Loader.get_spell_data( spell_id );
    
    if( xml.attr("self_target") == "1" )
    {
      cast_self_buff( spell_id );
    }
    else
    {
      crosshairs_cursor();
      set_command( spell_id );
      toggle_spell( btn_ix );
    }
  }
}

function cast_self_buff( spell_id )
{
  if( create_spell( spell_id, Player, Player.location ) )
  {
    Time.add_time( TIME_STANDARD_MOVE );
    Player.update_mana();
    document.game.is_player_move = true;
    document.game.do_turn();
  }
}

function toggle_spell( btn_ix )
{
  $("#spell" + btn_ix).button("toggle");
}

function create_spell( spell_id, source_actor, target )
{
  var xml = Loader.get_spell_data( spell_id );
  var type = xml.parent()[0].nodeName.toLowerCase();
  var success = false;
  
  if( type == "projectile" )
  {
    success = add_spell_effect( new ProjectileSpellEffect( xml.attr("projectile_id"), source_actor.location, target ),  new Spell( spell_id, source_actor, target ) );
  }
  else if( type == "areaeffect" )
  {
    success = add_spell_effect( new AreaSpellEffect( xml.attr("projectile_id"), xml.attr("area_id"), source_actor.location, target ),  new AreaEffectSpell( spell_id, source_actor, target ) );
  }
  else if( type == "coneeffect" )
  {
    success = process_cone_spell( xml, source_actor, target );
  }
  else if( type == "utility" )
  {
    if( spell_id == "u1" ) // Light
    {
      success = add_spell_effect( new ProjectileSpellEffect( xml.attr("projectile_id"), source_actor.location, target ), new LightSpell( spell_id, source_actor, target ) );
    }
    else if( spell_id == "u2" ) // Dimension Door
    {
      success = add_spell_effect( new SinglePointRotatingFadingSpellEffect( xml.attr("effect_id"), source_actor.location ), new TeleportationSpell( spell_id, source_actor ) );
    }
  }
  else if( type == "statusspells" ) // Status Effects
  {
    success = add_spell_effect( new SinglePointRotatingFadingSpellEffect( xml.attr("effect_id"), target ), new StatusEffectSpell( spell_id, xml.find("StatusEffect").text(), source_actor, target ) );
  }
  else
  {
    Log.debug( "Unrecognized command." );
  }
  
  return success;
}

function add_spell_effect( effect, spell )
{
  if( spell != undefined )
  {
    effect.set_spell_action( spell );  
  }
    
  if( spell == undefined || spell.consume_mana() )
  {
    document.game.animation_queue.push( effect );
    return true;
  }
  
  return false;
}

function draw_spells_for_interval( ctx )
{
  //Log.debug( "Spell draw loop" );
  
  for( var x = document.game.animation_queue.length - 1; x >= 0; --x )
  {
    document.game.animation_queue[x].draw( ctx );
    
    if( document.game.animation_queue[x].is_finished() )
    {
      //Log.debug( "Spell " + document.game.animation_queue[x].spell_id + " is finished!" );
      document.game.animation_queue[x].resolve();
      document.game.animation_queue[x] = null;
      document.game.animation_queue.splice( x, 1 );    
    }
  }
}

function process_cone_spell( xml, source_actor, orig_target )
{
  var vector = source_actor.location.get_unit_vector( orig_target );
  var target = new Point( source_actor.location );
  target.add_vector( vector );
  
  if( vector.neither_coord_is_zero() )  
  {
    add_spell_effect( new DiagonalConeSpellEffect( xml.attr("diagonal_id"), source_actor.location, target ), new ConeEffectSpell( xml.attr("id"), source_actor, target ) );
  }
  else
  {
    add_spell_effect( new ConeSpellEffect( xml.attr("cardinal_id"), source_actor.location, target ), new ConeEffectSpell( xml.attr("id"), source_actor, target ) );
  }
  
  return true;
}

function Spell( spell_id, source_actor, target_tile )
{
  this.spell_id = spell_id;
  this.source_actor = source_actor;
  this.target_tile = new Point( target_tile.x, target_tile.y );
  this.load_from_xml();
}

Spell.prototype.load_from_xml = function()
{
  var xml = Loader.get_spell_data( this.spell_id );

  this.description = xml.find("Description").text();
  this.mana_cost   = xml.find("Mana").text();
  this.damage      = xml.find("Damage").text();
  this.splash      = xml.find("Splash").text();
  this.verb        = xml.find("Verb").text();
  this.action      = xml.find("Action").text();
};

Spell.prototype.consume_mana = function()
{
  // Can't cast the spell if the actor doesn't have enough mana (only a problem for Player)
  if( this.source_actor.current_mana >= this.mana_cost )
  {
    this.source_actor.current_mana -= this.mana_cost;
    return true;
  }
  else
  {
    Log.add( "You do not have enough mana to cast " + this.description + "!" );
    set_finished();
    return false;
  }
};

Spell.prototype.resolve_miss = function()
{
  // Monsters can't miss with spells (yet) so no need to add anything here right now.
  Log.add( "Your " + this.description + " hits an obstacle and fizzles!" ); 
};

Spell.prototype.resolve_hit = function()
{
  var target_item = Map.get_target_item_in_tile( this.target_tile );

  if( target_item == undefined )
  {
    Log.add( "Your " + this.description + " hits nothing." ); // Spell targeted an empty tile
  }
  else
  {
    if( this.source_actor.is_monster )
    {
      if( target_item.is_monster )
      {
        Log.add( "The " + this.source_actor.description + "'s " + this.description + " " + this.verb + " the " + target_item.description + "!" );   // Monster hits monster
      }
      else
      {
        Log.add( "The " + this.source_actor.description + "'s " + this.description + " " + this.verb + " you!" );   // Monster hits player
      }
    }
    else
    {
      if( target_item.is_door )
      {
        Log.add( "Your " + this.description + " blasts open the door!" );
      }
      else
      {
        Log.add( "Your " + this.description + " " + this.verb + " the " + target_item.description + "!" ); // Player hits monster
      }
    }
    
    target_item.damage( this.damage );
  }
};

Spell.prototype.reassign_target = function( new_target )
{
  this.target_tile.assign( new_target ); 
};

function LightSpell( spell_id, source_actor, target_tile )
{
  LightSpell.base_constructor.call( this, spell_id, source_actor, target_tile );
  
  this.light_target = function()
  {
    var map_tiles = Dungeon.get_map_tiles();
    
    if( map_tiles[this.target_tile.y][this.target_tile.x].is_a_room() )
    {
      // Light up and explore the entire room
      var room_id = map_tiles[this.target_tile.y][this.target_tile.x].room_id;
      Dungeon.update_room_tiles( map_tiles, room_id, explore_tile );
      Dungeon.update_room_tiles( map_tiles, room_id, light_tile );
    }
    else
    {
      // Light up the square and its neigbours
      Dungeon.update_adjacent_tiles( map_tiles, this.target_tile, explore_tile );
      Dungeon.update_adjacent_tiles( map_tiles, this.target_tile, light_tile );
    }
  };
}
extend( LightSpell, Spell );

LightSpell.prototype.resolve_miss = function()
{
  this.light_target();
};

LightSpell.prototype.resolve_hit = function()
{
  this.light_target();
};

function TeleportationSpell( spell_id, source_actor )
{
  var MIN_DISTANCE = 5;
  
  TeleportationSpell.base_constructor.call( this, spell_id, source_actor, source_actor.location );
  Log.add( "The air tingles around you..." );
  
  this.randomize_distance = function( start )
  {
    var distance = ( MIN_DISTANCE + random_type( MIN_DISTANCE ) ) * ( chance( 50 ) ? -1 : 1 );
    return start + distance;
  };
  
  this.teleport = function()
  {
    var target = new Point();
    
    // Limit to 10 attempts at finding an empty random location nearby.
    for( var ix = 0; ix < 10; ++ix )
    {
      target.x = this.randomize_distance( this.source_actor.location.x );
      target.y = this.randomize_distance( this.source_actor.location.y );
      
      //Log.debug( "Attempting teleport to " + target.to_string() );
      
      if( Map.is_location_inbounds( target ) && Map.is_location_passable( target ) && Dungeon.get_monster_in_tile( target ) == null && Dungeon.get_door_in_tile( target ) == null )
      {
        Player.location.assign( target );
        Dungeon.explore_at_location( target );
        Map.center_map_on_location( target );
        Log.add( "You are yanked through reality to a new location!" );
        return;
      }
    }
    
    Log.add( "Nothing happens!" );
  };
}
extend( TeleportationSpell, Spell );

TeleportationSpell.prototype.resolve_hit = function()
{
  this.teleport();
};

function StatusEffectSpell( spell_id, status_id, source_actor, target_tile )
{
  StatusEffectSpell.base_constructor.call( this, spell_id, source_actor, target_tile );
  
  //this.status_id = status_id;
  
  this.apply_effect = function()
  {
    var target_item = Map.get_target_item_in_tile( this.target_tile );
    
    if( target_item.id == "man" || target_item.is_monster )
    {
      create_status_effect( status_id, target_item );
    }
  };
}
extend( StatusEffectSpell, Spell );

StatusEffectSpell.prototype.resolve_hit = function()
{
  this.apply_effect();
};

function AreaEffectSpell( spell_id, source_actor, target_tile )
{
  AreaEffectSpell.base_constructor.call( this, spell_id, source_actor, target_tile );
}
extend( AreaEffectSpell, Spell );

AreaEffectSpell.prototype.show_no_primary_target_message = function()
{
  // Monsters can't miss with spells (yet) so no need to add anything here right now.
  Log.add( "Your " + this.description + " explodes in mid-air!" );
};

AreaEffectSpell.prototype.show_hit_message = function( target_item )
{
  if( target_item.is_monster )
  {
    Log.add( "Your " + this.description + " " + this.verb + " the " + target_item.description + "!" );  // Player hits monster
  }
  else if( target_item.is_door )
  {
    Log.add( "Your " + this.description + " blasts open the door!" );
  }
  else
  {
    if( this.source_actor.is_monster )
    {
      Log.add( "The " + this.source_actor.description + "'s " + this.description + " " + this.verb + "you!" ); // Monster hits player
    }
    else
    {
      Log.add( "You are caught in the blast from your own " + this.description + "!" );  // Player hits self
    }
  }
};

AreaEffectSpell.prototype.resolve_miss = function()
{
  this.show_no_primary_target_message();
  this.resolve_splash();
};

AreaEffectSpell.prototype.resolve_hit = function()
{
  var target_item = Map.get_target_item_in_tile( this.target_tile );

  if( target_item == undefined )
  {
    this.show_no_primary_target_message();
  }
  else
  {
    this.show_hit_message( target_item );
    target_item.damage( this.damage );
  }
  
  this.resolve_splash();
};

AreaEffectSpell.prototype.resolve_splash = function()
{
  var map_tiles = Dungeon.get_map_tiles();
  
  for( var row = this.target_tile.y - 1; row <= this.target_tile.y + 1; ++row )
  {
    for( var col = this.target_tile.x - 1; col <= this.target_tile.x + 1; ++col )
    {
      var location = new Point( col, row );
      
      if( row >= 0 && row <= map_tiles.length && col >= 0 && col <= map_tiles[0].length && !this.target_tile.equals( location ) )
      {
        var target_item = Map.get_target_item_in_tile( location );
        
        if( target_item != undefined )
        {
          this.show_hit_message( target_item );
          target_item.damage( this.splash );
        }
      }
    }
  }
};

function ConeEffectSpell( spell_id, source_actor, target_tile )
{
  ConeEffectSpell.base_constructor.call( this, spell_id, source_actor, target_tile );
  
  this.num_hits = 0;
}
extend( ConeEffectSpell, Spell );

ConeEffectSpell.prototype.show_no_primary_target_message = function()
{
  // Monsters can't miss with spells (yet) so no need to add anything here right now.
  Log.add( "Your " + this.description + " hits nothing!" );
};

ConeEffectSpell.prototype.show_hit_message = function( target_item )
{
  if( target_item.is_monster )
  {
    if( this.source_actor.is_monster )
    {
      Log.add( "The " +  this.source_actor.description + "'s " + this.description + " " + this.verb + " the " + target_item.description + "!" );  // Monster hits monster
    }
    else
    {
      Log.add( "Your " + this.description + " " + this.verb + " the " + target_item.description + "!" );  // Player hits monster
    }
  }
  else if( target_item.is_door )
  {
    if( this.source_actor.is_monster )
    {
      Log.add( "The " +  this.source_actor.description + "'s " + this.description + " blasts open the door!" );  // Monster hits door
    }
    else
    {
      Log.add( "Your " + this.description + " blasts open the door!" );
    }
  }
  else if( this.source_actor.is_monster )
  {
    Log.add( "The " + this.source_actor.description + "'s " + this.description + " " + this.verb + " you!" ); // Monster hits player
  }
};

ConeEffectSpell.prototype.resolve_miss = function()
{
  // Cones don't miss.
};

ConeEffectSpell.prototype.resolve_hit = function()
{
  var map_tiles = Dungeon.get_map_tiles();
  var current_tile = this.get_top_left_for_cone();
  
  for( var row = current_tile.y; row <= current_tile.y + 2; ++row )
  {
    for( var col = current_tile.x; col <= current_tile.x + 2; ++col )
    {
      if( row >= 0 && row <= map_tiles.length && col >= 0 && col <= map_tiles[0].length )
      {
        var target_item = Map.get_target_item_in_tile( new Point( col, row ) );
        
        if( target_item != undefined )
        {
          this.show_hit_message( target_item );
          target_item.damage( this.damage );
        }
      }
    }
  }
};

ConeEffectSpell.prototype.get_top_left_for_cone = function()
{
  var top_left = this.source_actor.location.get_unit_vector( this.target_tile );
  top_left.x = this.adjust_cone_vector_coord( top_left.x );
  top_left.y = this.adjust_cone_vector_coord( top_left.y );
  top_left.add_vector( this.source_actor.location );
  
  return top_left;
};

ConeEffectSpell.prototype.adjust_cone_vector_coord = function( value )
{
  if( value < 0 )
  {
    value = -3; 
  }
  else if( value == 0 )
  {
    value = -1; 
  }

  return value; 
};

//
//
// ANIMATIONS BELOW HERE
//
//

function SpellEffect( spell_id )
{
  this.spell_id = spell_id;
  this.canvas_x = 0;
  this.canvas_y = 0;
  this.img_loc = convert_tile_ix_to_point( spell_id );
}

SpellEffect.prototype.set_spell_action = function( spell_action )
{
  this.spell_action = spell_action;
};

SpellEffect.prototype.draw = function( ctx )
{
  ctx.save();
  
  //Log.debug( "Drawing frame for spell " + this.spell_id );
  this.update_frame( ctx );
  ctx.drawImage( Images.SPELL_IMAGES, this.img_loc.x, this.img_loc.y, TILE_WIDTH, TILE_WIDTH, this.canvas_x, this.canvas_y, TILE_WIDTH, TILE_WIDTH );
  
  ctx.restore();
};

// Overload this function to define how the animation knows if it is done.
SpellEffect.prototype.is_finished = function()
{
  return true; 
};

// Overload this function to update animation details before we draw this particular spell effect.
SpellEffect.prototype.update_frame = function( ctx )
{
  return; 
};

// Overload this function to perform any actions when the spell finishes (i.e. chaining effects)
SpellEffect.prototype.resolve = function()
{
  return; 
};

SpellEffect.prototype.resolve_miss = function()
{
  if( this.spell_action != undefined )
  {
    this.spell_action.resolve_miss(); 
  }
};

SpellEffect.prototype.resolve_hit = function()
{
  if( this.spell_action != undefined )
  {
    this.spell_action.resolve_hit(); 
  }
};

function SinglePointFadingSpellEffect( spell_id, raw_target )
{
  SinglePointFadingSpellEffect.base_constructor.call( this, spell_id );
  this.alpha      = 1.0;
  
  this.canvas_x = raw_target.x;
  this.canvas_y = raw_target.y;
}
extend( SinglePointFadingSpellEffect, SpellEffect );

SinglePointFadingSpellEffect.prototype.is_finished = function()
{
  return this.alpha <= 0.0; 
};

SinglePointFadingSpellEffect.prototype.update_frame = function( ctx )
{
  this.alpha = Math.max( 0, this.alpha - 0.15 );
  ctx.globalAlpha = this.alpha;
};


function MapFadeOut()
{
  MapFadeOut.base_constructor.call( this, 0 );
  this.alpha = 0.0;
}
extend( MapFadeOut, SpellEffect );

MapFadeOut.prototype.is_finished = function()
{
  return this.alpha >= 1.0; 
};

MapFadeOut.prototype.update_frame = function( ctx )
{
  this.alpha = Math.min( 1.0, this.alpha + 0.10 );
  ctx.fillStyle = "rgba(0,0,0," + this.alpha + ")";
};

MapFadeOut.prototype.draw = function( ctx )
{
  ctx.save();
  
  this.update_frame( ctx );
  ctx.fillRect( 0, 0, VIEWPORT_WIDTH * TILE_WIDTH, VIEWPORT_HEIGHT * TILE_WIDTH );
  
  ctx.restore();
};

function SinglePointRotatingFadingSpellEffect( spell_id, target )
{
  var raw_target = new Point();
  raw_target.assign( target );
  raw_target.convert_to_raw_tile_center();
  
  SinglePointRotatingFadingSpellEffect.base_constructor.call( this, spell_id, raw_target );
  this.angle = 0;
}
extend( SinglePointRotatingFadingSpellEffect, SinglePointFadingSpellEffect );

SinglePointRotatingFadingSpellEffect.prototype.update_frame = function( ctx )
{
  SinglePointFadingSpellEffect.prototype.update_frame.call( this, ctx );
  
  this.angle += 5;
  ctx.translate( this.canvas_x, this.canvas_y );
  ctx.rotate( this.angle * Math.PI / 180 );
};

SinglePointRotatingFadingSpellEffect.prototype.draw = function( ctx )
{
  ctx.save();
  
  this.update_frame( ctx );
  ctx.drawImage( Images.SPELL_IMAGES, this.img_loc.x, this.img_loc.y, TILE_WIDTH, TILE_WIDTH, -(TILE_WIDTH/2), -(TILE_WIDTH/2), TILE_WIDTH, TILE_WIDTH );
  
  ctx.restore();
};

SinglePointRotatingFadingSpellEffect.prototype.is_finished = function()
{
  if( SinglePointRotatingFadingSpellEffect.super_class.is_finished.call( this ) )
  {
    this.resolve_hit();
    return true;
  }
};

function ProjectileSpellEffect( spell_id, source, target )
{
  this.MAX_VELOCITY = 15;
  this.MIN_VELOCITY = 3;
  this.ACCELERATION = 2;
  this.last_clear_cell = new Point();
  
  ProjectileSpellEffect.base_constructor.call( this, spell_id );
  this.source = new Point( source.x, source.y );
  this.target = new Point( target.x, target.y );
  
  this.raw_source = new Point( this.source.x, this.source.y );
  this.raw_source.convert_to_raw_tile_center();
  
  this.raw_target = new Point( this.target.x, this.target.y );
  this.raw_target.convert_to_raw_tile_center();
  
  this.canvas_x = this.raw_source.x;
  this.canvas_y = this.raw_source.y;
  
  this.dx = this.raw_target.x - this.raw_source.x;
  this.dy = this.raw_target.y - this.raw_source.y;
  this.rotation = this.get_spell_rotation();
  
  this.distance = this.raw_source.distance_to( this.raw_target );
  this.velocity = this.MIN_VELOCITY;
  
  this.slope_x = this.dx / this.distance;
  this.slope_y = this.dy / this.distance;
  
  //Log.debug( "slope_x = " + this.slope_x + "  slope_y = " + this.slope_y );
  //Log.debug( "rotation = " + this.rotation );
  //Log.debug( "angle = " + this.angle );
}
extend( ProjectileSpellEffect, SpellEffect );

ProjectileSpellEffect.prototype.is_finished = function()
{
  var current_tile = new Point( this.canvas_x, this.canvas_y );
  current_tile.convert_to_tile_coord();
  
  if( this.distance <= 0 )
  {
    this.handle_arrived_at_target( current_tile );
    return true; 
  }
  else if( this.has_collided_with_map_obstacle( current_tile ) )
  {   
    this.handle_obstacle_collision( current_tile );
    return true;
  }
  else if( this.spell_action != undefined && this.has_collided_with_unexpected_obstacle( current_tile ) )
  {
    this.handle_unexpected_target_collision( current_tile );
    return true;
  }
  
  this.last_clear_cell.assign( current_tile );
  return false;
};

ProjectileSpellEffect.prototype.handle_arrived_at_target = function( current_tile )
{
  this.resolve_hit();
};

ProjectileSpellEffect.prototype.handle_obstacle_collision = function( current_tile )
{
  add_spell_effect( new SinglePointFadingSpellEffect( FIZZLE, new Point( this.canvas_x - (TILE_WIDTH/2), this.canvas_y - (TILE_WIDTH/2) ) ) );
  
  if( this.spell_action )
  {
    this.spell_action.reassign_target( current_tile );
  }
  
  this.resolve_miss();
};

ProjectileSpellEffect.prototype.handle_unexpected_target_collision = function( current_tile )
{
  this.spell_action.reassign_target( current_tile );
  this.resolve_hit();
};

ProjectileSpellEffect.prototype.update_frame = function( ctx )
{
  this.update_velocity();
  this.update_distance_remaining();
  this.update_canvas_location();
  
  ctx.translate( this.canvas_x, this.canvas_y );
  ctx.rotate( this.rotation * Math.PI / 180 );
};

ProjectileSpellEffect.prototype.update_velocity = function()
{
  if( this.velocity < this.MAX_VELOCITY )
  {
    this.velocity = Math.min( this.velocity + this.ACCELERATION, this.MAX_VELOCITY );
  }

  return this.velocity;
};

ProjectileSpellEffect.prototype.update_distance_remaining = function()
{
  this.distance -= this.velocity;
  //Log.debug( "distance remaining = " + this.distance );
};

ProjectileSpellEffect.prototype.update_canvas_location = function()
{
  this.canvas_x += ( this.slope_x * this.velocity );
  this.canvas_y += ( this.slope_y * this.velocity );
};

ProjectileSpellEffect.prototype.draw = function( ctx )
{
  ctx.save();
  
  this.update_frame( ctx );
  ctx.drawImage( Images.SPELL_IMAGES, this.img_loc.x, this.img_loc.y, TILE_WIDTH, TILE_WIDTH, -(TILE_WIDTH/2), -(TILE_WIDTH/2), TILE_WIDTH, TILE_WIDTH );
  
  ctx.restore();
};

ProjectileSpellEffect.prototype.get_spell_rotation = function()
{
  if( Math.abs( this.dx ) > Math.abs( this.dy ) )
  {
    return this.dx <= 0 ? 0 : 180;
  }
  else
  {
    return this.dy <= 0 ? 90 : 270;
  }
};

ProjectileSpellEffect.prototype.has_collided_with_map_obstacle = function( current_tile )
{
  if( !Map.is_valid_move( current_tile ) )
  {      
    Log.debug( "Map collision detected with " + current_tile.to_string() );
    return true; 
  }
 
  return false;
};

ProjectileSpellEffect.prototype.has_collided_with_unexpected_obstacle = function( current_tile )
{
  var current_item = Map.get_target_item_in_tile( current_tile );
  
  if( current_item != undefined && !current_item.location.equals( this.source ) && !current_item.location.equals( this.spell_action.target_tile ) )
  {
    if( current_item.is_door && current_item.is_open() )    // Open doors do not count as obstacles for projectiles
    {
      return false;
    }
    else
    {
      Log.debug( "Current tile is occupied. Resetting target to " + current_tile.to_string() );
      return true;
    }
  }
  
  return false;
};

function ScalingRotatingFadingSpellEffect( spell_id, target )
{
  ScalingRotatingFadingSpellEffect.base_constructor.call( this, spell_id, target );

  this.scale = 0.25;
  this.alpha = 0;
  this.img_loc = convert_big_tile_ix_to_point( spell_id );
}
extend( ScalingRotatingFadingSpellEffect, SinglePointRotatingFadingSpellEffect );

ScalingRotatingFadingSpellEffect.prototype.is_finished = function()
{
  return this.angle >= 180; 
};

ScalingRotatingFadingSpellEffect.prototype.update_frame = function( ctx )
{
  this.update_scale();
  this.update_angle();
  
  ctx.translate( this.canvas_x, this.canvas_y );
  ctx.scale( this.scale, this.scale );
  ctx.rotate( this.angle * Math.PI / 180 );
};

ScalingRotatingFadingSpellEffect.prototype.draw = function( ctx )
{
  ctx.save();
  
  this.update_frame( ctx );
  ctx.drawImage( Images.BIG_SPELL_IMAGES, this.img_loc.x, this.img_loc.y, AREA_SPELL_WIDTH, AREA_SPELL_WIDTH, -(AREA_SPELL_WIDTH/2), -(AREA_SPELL_WIDTH/2), AREA_SPELL_WIDTH, AREA_SPELL_WIDTH );
  
  ctx.restore();
};

ScalingRotatingFadingSpellEffect.prototype.update_scale = function()
{
  this.scale = Math.min( 1.0, this.scale + 0.05 );
};

ScalingRotatingFadingSpellEffect.prototype.update_angle = function()
{
  this.angle += 10;
};

function AreaSpellEffect( projectile_id, area_id, source, target )
{
  AreaSpellEffect.base_constructor.call( this, projectile_id, source, target );
  this.area_id = area_id;
}
extend( AreaSpellEffect, ProjectileSpellEffect );

AreaSpellEffect.prototype.handle_arrived_at_target = function( current_tile )
{
  add_spell_effect( new ScalingRotatingFadingSpellEffect( this.area_id, this.last_clear_cell ) );
  this.resolve_hit();
};

AreaSpellEffect.prototype.handle_obstacle_collision = function()
{
  add_spell_effect( new ScalingRotatingFadingSpellEffect( this.area_id, this.last_clear_cell ) );
  this.resolve_miss();
};

AreaSpellEffect.prototype.handle_unexpected_target_collision = function( current_tile )
{
  add_spell_effect( new ScalingRotatingFadingSpellEffect( this.area_id, current_tile ) );
  this.spell_action.reassign_target( current_tile );
  this.resolve_hit();
};

function ConeSpellEffect( spell_id, source, target )
{
  ConeSpellEffect.base_constructor.call( this, spell_id );
  
  this.img_loc = convert_big_tile_ix_to_point( spell_id );
  this.GROWTH_RATE = 4;
  
  this.source = new Point( source.x, source.y );
  this.target = new Point( target.x, target.y );
  
  this.raw_target = new Point( this.target.x, this.target.y );
  this.raw_target.convert_to_raw_tile_center();
  
  this.canvas_x = this.raw_target.x;
  this.canvas_y = this.raw_target.y;
  
  this.scale = 0;
  this.alpha = 0.40;
  this.size = TILE_WIDTH;
  this.angle = this.get_spell_rotation();
}
extend( ConeSpellEffect, SpellEffect );

ConeSpellEffect.prototype.is_finished = function()
{
  if( this.scale >= 1.0 )
  {
    this.resolve_hit();
    return true;
  }
  
  return false;
};

ConeSpellEffect.prototype.update_frame = function( ctx )
{
  this.update_alpha( ctx );
  this.update_position();
  this.update_scale();
  
  ctx.translate( this.canvas_x, this.canvas_y );
  ctx.scale( this.scale, this.scale );
  ctx.rotate( this.angle * Math.PI / 180 );
};

ConeSpellEffect.prototype.update_alpha = function( ctx )
{
  this.alpha = Math.min( 1.0, this.alpha + 0.08 );
  ctx.globalAlpha = this.alpha;
};

ConeSpellEffect.prototype.update_position = function()
{
  switch( this.angle )
  {
    case 0:
      this.canvas_y -= this.GROWTH_RATE/2;
      break;
    case 180:
      this.canvas_y += this.GROWTH_RATE/2;
      break;
    case 90:
      this.canvas_x += this.GROWTH_RATE/2;
      break;
    case 270:
      this.canvas_x -= this.GROWTH_RATE/2;
      break;
  }
};

ConeSpellEffect.prototype.update_scale = function()
{  
  this.size += this.GROWTH_RATE;
  this.scale = this.size / AREA_SPELL_WIDTH;
};

ConeSpellEffect.prototype.draw = function( ctx )
{
  ctx.save();
  
  this.update_frame( ctx );
  ctx.drawImage( Images.BIG_SPELL_IMAGES, this.img_loc.x, this.img_loc.y, AREA_SPELL_WIDTH, AREA_SPELL_WIDTH, -(AREA_SPELL_WIDTH/2), -(AREA_SPELL_WIDTH/2), AREA_SPELL_WIDTH, AREA_SPELL_WIDTH );
 
  ctx.restore();
};

ConeSpellEffect.prototype.get_spell_rotation = function()
{
  var direction = this.source.get_unit_vector( this.target );
  
  if( Math.abs( direction.x ) > Math.abs( direction.y ) )
  {
    return direction.x <= 0 ? 270 : 90;
  }
  else
  {
    return direction.y <= 0 ? 0 : 180;
  }
};

function DiagonalConeSpellEffect( spell_id, source, target )
{
  DiagonalConeSpellEffect.base_constructor.call( this, spell_id, source, target );
  
}
extend( DiagonalConeSpellEffect, ConeSpellEffect );

DiagonalConeSpellEffect.prototype.get_spell_rotation = function()
{
  var direction = this.source.get_unit_vector( this.target );
  
  if( direction.x >= 0 )
  {
    return direction.y >= 0 ? 90 : 0;
  }
  else
  {
    return direction.y <= 0 ? 270 : 180;
  }
};

DiagonalConeSpellEffect.prototype.update_position = function()
{
  switch( this.angle )
  {
    case 0:
      this.canvas_y -= this.GROWTH_RATE/2;
      this.canvas_x += this.GROWTH_RATE/2;
      break;
    case 180:
      this.canvas_y += this.GROWTH_RATE/2;
      this.canvas_x -= this.GROWTH_RATE/2;
      break;
    case 90:
      this.canvas_y += this.GROWTH_RATE/2;
      this.canvas_x += this.GROWTH_RATE/2;
      break;
    case 270:
      this.canvas_y -= this.GROWTH_RATE/2;
      this.canvas_x -= this.GROWTH_RATE/2;
      break;
  }
};
var DEBUGGING = 0;
var FREEZE_MONSTERS = 0;      // Stop all monsters from moving and attacking
var MONSTER_SPELLS = 1;       // Allow applicable monsters to cast spells
var DETECT_MONSTERS = 0;      // Detect all monsters

var MAGIC_MISSILE = 2;
var FIREBALL = 0;
var FIRE_BREATH = 1;
var FIRE_BREATH_D = 2;

var RATMAN = 0;
var HILLGIANT = 1;

function run_test()
{
  var test = parseInt( $("#test_menu").val() );
  
  switch( test )
  {
    case 0: test_fizzle(); break;
    case 1: test_splat(); break;
    case 2: test_projectiles(); break;
    case 3: test_aoe(); break;
    case 4: kill_all_monsters(); break;
    case 5: document.game.do_turn(); break;
    case 6: test_cones(); break;
    case 7: test_diagonal_cones(); break;
    case 8: reveal_map(); break;
    case 9: test_game_over(); break;
    case 10: reveal_secret_doors(); break;
    case 11: Storage.erase(); break;
    case 12: reveal_traps(); break;
    case 13: learn_all_spells(); break;
    case 14: test_status_effect(); break;
    case 15: test_poison_effect("1"); break;
    case 16: test_poison_effect("2"); break;
  }
}

function cast_spell_by_id( spell )
{
  if( !is_processing() )
  {
    crosshairs_cursor();
    toggle_spell( SpellBar.get_button_ix( spell ) );
    set_command( spell );
  }
}

function get_debug_spellbar()
{
 return ["p1","p2","p3","e2","e3","e4"]; 
}

function test_fizzle()
{
  if( !is_processing() )
  {
    add_spell_effect( new SinglePointFadingSpellEffect( FIZZLE, new Point(100,100) ) );
    add_spell_effect( new SinglePointFadingSpellEffect( FIZZLE, new Point(500,100) ) );
    add_spell_effect( new SinglePointFadingSpellEffect( FIZZLE, new Point(250,250) ) );
    document.game.draw_spells();
  }
}

function test_projectiles()
{
  if( !is_processing() )
  {
    add_spell_effect( new ProjectileSpellEffect( MAGIC_MISSILE, Player.location, Map.top_left ) );
    add_spell_effect( new ProjectileSpellEffect( MAGIC_MISSILE, Player.location, new Point( Map.top_left.x + Math.floor(VIEWPORT_WIDTH/2), Map.top_left.y ) ) );
    add_spell_effect( new ProjectileSpellEffect( MAGIC_MISSILE, Player.location, new Point( Map.top_left.x + VIEWPORT_WIDTH - 1, Map.top_left.y ) ) );
    add_spell_effect( new ProjectileSpellEffect( MAGIC_MISSILE, Player.location, new Point( Map.top_left.x, Map.top_left.y + Math.floor(VIEWPORT_HEIGHT/2) ) ) );
    add_spell_effect( new ProjectileSpellEffect( MAGIC_MISSILE, Player.location, new Point( Map.top_left.x + VIEWPORT_WIDTH - 1, Map.top_left.y + Math.floor(VIEWPORT_HEIGHT/2) ) ) );
    add_spell_effect( new ProjectileSpellEffect( MAGIC_MISSILE, Player.location, new Point( Map.top_left.x, Map.top_left.y + VIEWPORT_HEIGHT - 1 ) ) );
    add_spell_effect( new ProjectileSpellEffect( MAGIC_MISSILE, Player.location, new Point( Map.top_left.x + Math.floor(VIEWPORT_WIDTH/2), Map.top_left.y + VIEWPORT_HEIGHT - 1 ) ) );
    add_spell_effect( new ProjectileSpellEffect( MAGIC_MISSILE, Player.location, new Point( Map.top_left.x + VIEWPORT_WIDTH - 1, Map.top_left.y + VIEWPORT_HEIGHT - 1 ) ) );
    document.game.draw_spells();
  }
}

function test_splat()
{
  if( !is_processing() )
  {
    add_spell_effect( new SinglePointRotatingFadingSpellEffect( SPLAT, new Point( 5, 5 ) ) );
    document.game.draw_spells();
  }
}

function test_aoe()
{
  if( !is_processing() )
  {
    add_spell_effect( new ScalingRotatingFadingSpellEffect( FIREBALL, new Point( 7, 7 ) ) );
    document.game.draw_spells();
  }
}

function kill_all_monsters()
{
  var monsters = Dungeon.get_monsters();
  
  for( i = monsters.length - 1; i >= 0; --i )
  {
    monsters[i].kill();
  }
  
  document.game.do_turn();
}

function learn_all_spells()
{
  Loader.xml.find("Spell").each( function() {
          Player.spellbook.push( this.attributes[0].value );
      });
}

function test_cones()
{
  if( !is_processing() )
  {
    add_spell_effect( new ConeSpellEffect( FIRE_BREATH, Player.location, new Point( Player.location.x, Player.location.y - 1 ) ) );
    add_spell_effect( new ConeSpellEffect( FIRE_BREATH, Player.location, new Point( Player.location.x, Player.location.y + 1 ) ) );
    add_spell_effect( new ConeSpellEffect( FIRE_BREATH, Player.location, new Point( Player.location.x - 1, Player.location.y ) ) );
    add_spell_effect( new ConeSpellEffect( FIRE_BREATH, Player.location, new Point( Player.location.x + 1, Player.location.y ) ) );
    document.game.draw_spells();
  }
}

function test_diagonal_cones()
{
  if( !is_processing() )
  {
    add_spell_effect( new DiagonalConeSpellEffect( FIRE_BREATH_D, Player.location, new Point( Player.location.x + 1, Player.location.y - 1 ) ) );
    add_spell_effect( new DiagonalConeSpellEffect( FIRE_BREATH_D, Player.location, new Point( Player.location.x - 1, Player.location.y - 1 ) ) );
    add_spell_effect( new DiagonalConeSpellEffect( FIRE_BREATH_D, Player.location, new Point( Player.location.x - 1, Player.location.y + 1 ) ) );
    add_spell_effect( new DiagonalConeSpellEffect( FIRE_BREATH_D, Player.location, new Point( Player.location.x + 1, Player.location.y + 1) ) );
    document.game.draw_spells();
  }
}

function random_map()
{
  Dungeon.level_ix = 0;
  Dungeon.levels = new Array();
  Dungeon.create_level(0);
  Player.location.assign( Dungeon.levels[0].get_starting_location() );
  Dungeon.explore_at_location( Player.location );
  Map.center_map_on_location( Player.location );
  
  // Spawn monsters (start with one per room)
  for( var monster_ix = 0; monster_ix < Dungeon.levels[0].rooms.length; ++monster_ix )
  {
    Dungeon.levels[0].spawn_monster();
  }
  
  document.game.draw();
}

function switch_to_debug()
{
  Player = new PlayerActor();
  setup_debug_level();
  learn_all_spells();
  SpellBar.update_list( get_debug_spellbar() );
  SpellBar.update_toolbar();
  Dungeon.explore_at_location( Player.location );
  Map.center_map_on_location( Player.location );
  document.game.draw();
}

function reveal_map()
{
  var map_tiles = Dungeon.get_map_tiles();
  
  for( var row = 0; row < map_tiles.length; ++row )
  {
    for( var col = 0; col < map_tiles[0].length; ++col )
    {
      map_tiles[row][col].explored = true;
    }
  }
  
  document.game.do_turn();
}

function reveal_secret_doors()
{
  var doors = Dungeon.get_current_level().doors;
  
  for( var ix = 0; ix < doors.length; ++ix )
  {
    doors[ix].find();
  }
  
  document.game.do_turn();
}

function reveal_traps()
{
  var traps = Dungeon.get_current_level().traps;
  
  for( var ix = 0; ix < traps.length; ++ix )
  {
    traps[ix].found = true;
  }
  
  document.game.do_turn();
}

function test_game_over()
{
  if( !is_processing() )
  {
    Player.current_hp = 0;
    add_spell_effect( new MapFadeOut() );
    document.game.draw_spells();
  }
}

function setup_debug_level()
{
  Player.move_to( new Point( 10, 7 ) );
  
  for( var stat_ix = 0; stat_ix < NUM_STATS; ++stat_ix )
  {
    Player.stats[stat_ix].base_value    = 10;
    Player.stats[stat_ix].current_value = 10;
  }
  
  Dungeon.levels = new Array();
  create_debug_level();  
  create_debug_monsters();
  create_debug_items();
  create_debug_traps();
  create_debug_widgets();
}

function create_debug_monsters()
{
  var level = Dungeon.get_current_level();
  level.create_single_monster( RATMAN, new Point(  3, 3 ) );
  level.create_single_monster( RATMAN, new Point( 10, 2 ) );
  level.create_single_monster( RATMAN, new Point(  6,14 ) );
  level.create_single_monster( RATMAN, new Point( 12,14 ) );
  level.create_single_monster( HILLGIANT, new Point( 19, 9 ) );
  level.create_single_monster( RATMAN, new Point( 22,20 ) );  // in dark
  level.create_single_monster( RATMAN, new Point( 10,20 ) );  // in unexplored
  level.create_single_monster( 2, new Point( 18, 3 ) );  // inert slime
  level.create_single_monster( 7, new Point( 1, 22 ) );  // DRAGON
}

function create_debug_items()
{
  var level = Dungeon.get_current_level();
  level.create_single_item( "neck1", new Point( 1, 1 ) );
  level.create_single_item( "neck2", new Point( 11, 7 ) );
  level.create_single_item( "feet1", new Point( 18, 10 ) );
  level.create_single_item( "back1", new Point( 11, 7 ) );
  level.create_single_item( "head1", new Point( 5, 5 ) );
  level.create_single_item( "hands1", new Point( 26, 14 ) );
  level.create_single_item( "chest1", new Point( 6, 4 ) );
  level.create_single_item( "weapon1", new Point( 6, 14 ) );
  level.create_single_item( "weapon2", new Point( 26, 14 ) );
  level.create_single_item( "shield1", new Point( 16, 8 ) );
  level.create_single_item( "shield2", new Point( 24, 5 ) );
  level.create_single_item( "shield2", new Point( 10, 20 ) ); // in unexplored
  level.create_single_item( "shield2", new Point( 19, 22 ) ); // in dark
  level.create_single_item( "ring1", new Point( 9, 7 ) );
  level.create_single_item( "ring2", new Point( 9, 7 ) );
}

function create_debug_traps()
{
  var level = Dungeon.get_current_level();
  level.traps.push( new Trap( 1, new Point( 4, 11 ) ) );    // Spear
  level.traps.push( new Trap( 2, new Point( 10, 18 ) ) );   // Rune (resets)
}

function create_debug_widgets()
{
  var level = Dungeon.get_current_level();
  level.widgets.push( new Widget( 2, new Point( 4, 12 ) ) );  // Firepit
}

function create_debug_level()
{
  var new_level = new Level();
  
  var map_tiles = [ [ 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3 ],
                    [ 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3 ],
                    [ 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3 ],
                    [ 3, 1, 1, 1, 1, 1, 3, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 2, 1, 1, 3 ],
                    [ 3, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 3 ],
                    [ 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 2, 1, 1, 3 ],
                    [ 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 3 ],
                    [ 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 2, 1, 1, 3 ],
                    [ 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 3 ],
                    [ 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 3 ],
                    [ 3, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 2, 3, 3, 1, 1, 1, 1, 1, 1, 1, 3 ],
                    [ 3, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 3 ],
                    [ 3, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3 ],
                    [ 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3 ],
                    [ 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 3, 1, 1, 1, 1, 1, 3 ],
                    [ 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 3, 1, 1, 1, 1, 1, 3 ],
                    [ 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 5, 3, 1, 1, 1, 1, 1, 3 ],
                    [ 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 5, 5, 5, 5, 3, 3, 3, 3, 1, 1, 3 ],
                    [ 3, 1, 1, 1, 1, 1, 1, 1, 4, 4, 4, 4, 4, 1, 1, 1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 5, 3, 1, 1, 3 ],
                    [ 3, 1, 1, 1, 1, 1, 1, 1, 4, 4, 4, 4, 4, 1, 1, 1, 1, 1, 3, 5, 5, 5, 5, 5, 5, 5, 3, 1, 1, 3 ],
                    [ 3, 1, 1, 1, 1, 1, 1, 1, 4, 4, 4, 4, 4, 1, 1, 1, 1, 1, 3, 5, 5, 5, 5, 5, 5, 5, 3, 1, 1, 3 ],
                    [ 3, 1, 1, 1, 1, 1, 1, 1, 4, 4, 4, 4, 4, 1, 1, 1, 1, 1, 3, 5, 5, 5, 5, 5, 5, 5, 3, 1, 1, 3 ],
                    [ 3, 1, 1, 1, 1, 1, 1, 1, 4, 4, 4, 4, 4, 1, 1, 1, 1, 1, 3, 5, 5, 5, 5, 5, 5, 5, 3, 1, 1, 3 ],
                    [ 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3 ]
                  ];
 
  for( var row = 0; row < map_tiles.length; ++row )
  {
    new_level.map_tiles[row] = new Array();
    
    for( var col = 0; col < map_tiles[0].length; ++col )
    {
      new_level.map_tiles[row][col] = new Tile( map_tiles[row][col] );
      
      if( map_tiles[row][col] != 3 )
      {
        new_level.map_tiles[row][col].passable = true;
      }
      
      if( map_tiles[row][col] != 4 )
      {
        new_level.map_tiles[row][col].explored = true;
      }
      
      if( map_tiles[row][col] != 5 )
      {
        new_level.map_tiles[row][col].is_lit = true;
      }
    }
  }
  
  new_level.doors.push( new Door( CLOSED, 3, 16, 22 ) );
  new_level.map_tiles[16][22].is_entrance = true;
  new_level.doors.push( new Door( OPEN  , 3,  9, 21 ) );
  new_level.map_tiles[9][21].is_entrance = true;
  new_level.doors.push( new Door( SECRET, 3, 18, 18 ) );
  new_level.map_tiles[18][18].is_entrance = true;
  
  Dungeon.levels[0] = new_level;
}

function test_status_effect()
{
  create_status_effect( 4, Player );
  Log.debug( "Added BIG MUSCLES lasting 10 rounds." );
}

function test_poison_effect( effect_id )
{
  Log.debug( "Adding poison for 6 rounds." );
  create_status_effect( effect_id, Player );
}var MAP_WIDTH  = 50;
var MAP_HEIGHT = 50;
var MIN_ROOM_SIZE = 5;
var MAX_ROOM_SIZE = 11;
var TUNNEL_LENGTH = 3;

var NORTH = new Point( -1,  0 );
var SOUTH = new Point(  1,  0 );
var EAST  = new Point(  0, -1 );
var WEST  = new Point(  0,  1 );

var LIGHT_SOURCES = [ 2 ];  // Widget IDs for things that count as light sources

function Cell()
{
  this.blocked = false;
  this.room_id = -1;
  this.is_perimeter = false;
  this.is_corridor = false;
  this.is_entrance = false;
  this.is_deadend = false;
  this.is_stairs = false;
  this.is_lit = false;
  this.trapped = false;
  
  this.is_a_room = function()
  {
    return this.room_id != -1;
  };
  
  this.set_as_perimeter = function()
  {
    if( !this.blocked && !this.is_a_room() )
    {
      this.is_perimeter = true;
    }
  };
  
  this.is_clear_for_tunnel = function()
  {
    return !this.blocked && !this.is_perimeter && !this.is_corridor;
  };
  
  this.is_corridor_neighbour = function()
  {
    return this.is_corridor || this.is_entrance;
  };
}

function Room()
{
  Room.base_constructor.call( this );
  
  this.generate_random_dimension = function()
  {
    var size = Math.floor( Math.random() * MAX_ROOM_SIZE );
    
    if( size < MIN_ROOM_SIZE )
    {
      size = MIN_ROOM_SIZE; 
    }
    
    if( size % 2 == 0 )
    {
      size++; 
    }
    
    return size;
  };
  
  this.top_left = new Point();
  this.height = this.generate_random_dimension();
  this.width  = this.generate_random_dimension();
  this.room_id = -1;
  this.is_lit = false;
  
  this.contains_point = function( x, y )
  {
    return x >= this.top_left.x && x <= this.top_left.x + this.width && y >= this.top_left.y && y <= this.top_left.y + this.height;
  };
  
  this.contains_any_blocked_cell = function( map )
  {
    for( var row = this.top_left.y; row <= this.top_left.y + this.height; row++ )
    {
      for( var col = this.top_left.x; col <= this.top_left.x + this.width; col++ )
      {
        if( map[row][col].blocked || map[row][col].is_a_room() )
        {
          return true;
        }
      }
    }
    
    return false;
  };
  
  this.fits_on_map = function()
  {
    return this.top_left.x >= 0 
        && this.top_left.x + this.width < MAP_WIDTH
        && this.top_left.y >= 0
        && this.top_left.y + this.height < MAP_HEIGHT; 
  };
  
  this.place_room = function( map )
  {
    this.draw_perimeter( map );
    this.fill_room( map );
    this.block_corners( map );
  };
  
  this.draw_perimeter = function( map )
  {
    for( var col = this.top_left.x - 1; col < this.top_left.x + this.width + 1; col++ )
    {
      map[this.top_left.y - 1][col].set_as_perimeter();
      map[this.top_left.y + this.height][col].set_as_perimeter();
    }
    
    for( var row = this.top_left.y - 1; row < this.top_left.y + this.height + 1; row++ )
    {
      map[row][this.top_left.x - 1].set_as_perimeter();
      map[row][this.top_left.x + this.width].set_as_perimeter();
    }
  };
  
  function should_room_be_lit()
  {
    return chance( 50 ); 
  }
  
  this.fill_room = function( map )
  {
    this.is_lit = should_room_be_lit();
    
    for( var row = 0; row < this.height; row++ )
    {
      for( var col = 0; col < this.width; col++ )
      {
        map[row + this.top_left.y][col + this.top_left.x].room_id = this.room_id;
        map[row + this.top_left.y][col + this.top_left.x].is_lit = this.is_lit;
      }
    }
  };
  
  this.block_corners = function( map )  // TODO UNIT TEST
  {
    map[this.top_left.y - 1][this.top_left.x - 1].blocked = true;
    map[this.top_left.y - 1][this.top_left.x + this.width].blocked = true;
    map[this.top_left.y + this.height][this.top_left.x - 1].blocked = true;
    map[this.top_left.y + this.height][this.top_left.x + this.width].blocked = true;
  };
  
  this.get_room_center = function()
  {
    var center = new Point();
    center.x = this.top_left.x + Math.floor( this.width / 2 );
    center.y = this.top_left.y + Math.floor( this.height / 2 );
    return center;
  };
  
  this.get_random_location = function()
  {
    var location = new Point();
    location.x = this.top_left.x + Math.floor( Math.random() * this.width );
    location.y = this.top_left.y + Math.floor( Math.random() * this.height );
    return location;
  };
}
extend( Room, Serializable );

Room.prototype.load = function( obj )
{
  Room.super_class.load.call( this, obj );
  this.top_left = Storage.load_point( obj.top_left );
};

function DoorMaker( map, room )
{
  this.map = map;
  this.room = room;
  this.sills = new Array();
  
  this.get_num_doors = function()
  {
    var width = Math.floor( this.room.width / 2 );
    var height = Math.floor( this.room.height / 2 );
    var min_doors = Math.floor( Math.sqrt( width * height ) );
    return Math.max( 0, min_doors + Math.floor( Math.random() * min_doors ) - this.count_existing_doors_for_room() );
  };
  
  this.count_existing_doors_for_room = function()
  {
    var existing_doors = 0;
    
    for( var col = this.room.top_left.x; col < this.room.top_left.x + this.room.width; col++ )
    {
      existing_doors += map[this.room.top_left.y - 1][col].is_entrance;
      existing_doors += map[this.room.top_left.y + this.room.height][col].is_entrance;
    }
    
    for( var row = this.room.top_left.y; row < this.room.top_left.y + this.room.height; row++ )
    {
      existing_doors += map[row][this.room.top_left.x - 1].is_entrance;
      existing_doors += map[row][this.room.top_left.x + this.room.width].is_entrance;
    }
    
    return existing_doors;
  };
  
  this.get_possible_door_sills = function()
  {
    this.add_north_sills();
    this.add_south_sills();
    this.add_east_sills();
    this.add_west_sills();
  };
  
  this.add_north_sills = function()
  {
    this.add_valid_horizontal_sills( this.room.top_left.y - 1, -1 ); 
  };
  
  this.add_south_sills = function()
  {
    this.add_valid_horizontal_sills( this.room.top_left.y + this.room.height, 1 ); 
  };
  
  this.add_east_sills = function()
  {
    this.add_valid_vertical_sills( this.room.top_left.x + this.room.width, 1 ); 
  };
  
  this.add_west_sills = function()
  {
    this.add_valid_vertical_sills( this.room.top_left.x - 1, -1 ); 
  };
  
  this.add_valid_horizontal_sills = function( row, direction )
  {
    if( row <= 1 || row >= MAP_HEIGHT-1 ) return;
    
    for( var col = this.room.top_left.x; col < this.room.top_left.x + this.room.width; col += 2 )
    {
      if( !this.map[row][col].blocked && !this.map[row][col].is_entrance && !this.map[row + direction][col].blocked )
      {
        this.sills.push( this.map[row][col] );
      }
    }
  };
  
  this.add_valid_vertical_sills = function( col, direction )
  {
    if( col <= 1 || col >= MAP_WIDTH-1 ) return;
    
    for( var row = this.room.top_left.y; row < this.room.top_left.y + this.room.height; row += 2 )
    {
      if( !this.map[row][col].blocked && !this.map[row][col].is_entrance && !this.map[row][col + direction].blocked )
      {
        this.sills.push( this.map[row][col] );
      }
    }
  };
  
  this.create_doors = function()
  {    
    var num_doors = this.get_num_doors();
    this.get_possible_door_sills();
    
    for( var i = 0; i < num_doors; i++ )
    {
      var sill_num = Math.floor( Math.random() * this.sills.length );
      this.sills[sill_num].is_entrance = true;
    }
  };
}

function TunnelMaker( map )
{
  this.map = map;
  this.count = 0;
  
  this.create_tunnels = function()
  {
    for( var row = 0; row < MAP_HEIGHT/2; row++ )
    {
      for( var col = 0; col < MAP_WIDTH/2; col++ )
      {
        var next_row = ( row * 2 ) + 1;
        var next_col = ( col * 2 ) + 1;
        
        if( this.map[next_row][next_col].is_clear_for_tunnel() )
        {
          this.tunnel( next_row, next_col );
        }
      }
    }
  };
  
  this.tunnel = function( row, col )
  {
    var directions = this.get_tunnel_directions();
    
    for( var dir = 0; dir < 4; dir++ )
    {
      if( this.make_tunnel( row, col, directions[dir] ) )
      {
        var next_row = this.get_next_tunnel_position( row, directions[dir].x );
        var next_col = this.get_next_tunnel_position( col, directions[dir].y );
        this.tunnel( next_row, next_col );
      }
    }
  };
  
  this.get_next_tunnel_position = function( value, move )
  {
    return value + ( move * TUNNEL_LENGTH ) + -move;
  };
  
  this.get_tunnel_directions = function()
  {
    return [ NORTH, SOUTH, EAST, WEST ].shuffle(); 
  };
  
  this.make_tunnel = function( row, col, direction )
  {
    if( this.is_tunnel_clear( row, col, direction ) )
    {
      this.dig_tunnel( row, col, direction );
      return true;
    }
    
    return false;
  };
  
  this.is_tunnel_clear = function( row, col, direction )
  {
    if( this.map[row][col].is_a_room() )
    {
      return false;
    }
    
    for( var ix = 1; ix < TUNNEL_LENGTH; ix++ )
    {
      var next_row = row + ( direction.x * ix );
      var next_col = col + ( direction.y * ix );
      
      if( next_row <= 0 || next_row >= MAP_HEIGHT || next_col <= 0 || next_col >= MAP_WIDTH )
      {
        return false;
      }
      
      if( !this.map[next_row][next_col].is_clear_for_tunnel() )
      {
        return false;
      }
    }
    
    return true;
  };
  
  this.dig_tunnel = function( row, col, direction )
  {
    for( var ix = 0; ix < TUNNEL_LENGTH; ix++ )
    {
      var next_row = row + ( direction.x * ix );
      var next_col = col + ( direction.y * ix );
      
      if( !this.map[next_row][next_col].is_a_room() && !this.map[next_row][next_col].is_entrance )
      {
        this.map[next_row][next_col].is_corridor = true;
      }
    }
  };
}

function TunnelCrusher( map )
{
  this.map = map;
  this.deadends = new Array();
  this.directions = [ NORTH, SOUTH, EAST, WEST ];
  
  this.crush_tunnels = function()
  {
    this.gather_deadends();
    this.collapse_tunnels();    
  };
  
  this.gather_deadends = function()
  {
    for( var row = 1; row < MAP_HEIGHT; row++ )
    {
      for( var col = 1; col < MAP_WIDTH; col++ )
      {
        var location = new Point( row, col );
        
        if( this.map[row][col].is_corridor && this.is_cell_a_deadend( location ) )
        {
          this.deadends.push( location );
          this.map[row][col].is_deadend = true;
        }
      }
    }
  };
  
  this.is_cell_a_deadend = function( location )
  {
    var neighbours = 0;
    
    for( var ix = 0; ix < this.directions.length; ix++ )
    {
      var current_cell = new Point( location.x, location.y );
      current_cell.add_vector( this.directions[ix] );
      
      if( this.map[current_cell.x] != undefined 
       && this.map[current_cell.x][current_cell.y] != undefined 
       && this.map[current_cell.x][current_cell.y].is_corridor_neighbour()
       )
      {
        neighbours++;
      }
    }
    
    return neighbours <= 1;
  };
  
  this.collapse_tunnels = function()
  {
    var num_deadends = this.deadends.length;
    
    for( var ix = 0; ix < num_deadends; ix++ )
    {
      if( chance( 90 ) )
      {
        this.collapse_single_tunnel( this.deadends[ix] );
      }
    }
  };
  
  this.collapse_single_tunnel = function( start )
  {
    var current_cell = new Point( start.x, start.y );
    
    while( this.is_cell_a_deadend( current_cell ) )
    {
      this.map[current_cell.x][current_cell.y].is_corridor = false;
      
      var next_cell = this.get_next_tunnel_cell( current_cell );
      
      if( next_cell != null )
      {
        current_cell.assign( next_cell );
        next_cell = null;
      }
      else
      {
        break; 
      }
    }
  };
  
  this.get_next_tunnel_cell = function( location )
  {
    for( var ix = 0; ix < this.directions.length; ix++ )
    {
      var current_cell = new Point( location.x, location.y );
      current_cell.add_vector( this.directions[ix] );
      
      if( this.map[current_cell.x] != undefined 
       && this.map[current_cell.x][current_cell.y] != undefined 
       && this.map[current_cell.x][current_cell.y].is_corridor
       )
      {
        return new Point( current_cell.x, current_cell.y );
      }
    }
  };
};

function Door( type, cover_ix, row, col )
{
  Door.base_constructor.call( this );
  
  var OPEN_DOOR_IMG = 7;
  var CLOSED_DOOR_IMG = 6;
  var BROKEN_DOOR_IMG = 8;
  
  this.is_door = true;
  this.type = type;
  this.is_open = false;
  this.cover_ix = cover_ix;
  this.location = new Point( col, row );
  
  this.draw = function( ctx )
  {
    if( Dungeon.is_location_explored( this.location ) )
    {
      var view_pos = Map.translate_map_coord_to_viewport( this.location );
      var tile_ix = this.cover_ix;
      
      switch( this.type )
      {
        case 1:
          tile_ix = OPEN_DOOR_IMG;
          break;
        case 0:
          tile_ix = CLOSED_DOOR_IMG;
          break;
        case 3:
          tile_ix = BROKEN_DOOR_IMG;
          break;
      }

      var img_loc = convert_tile_ix_to_point( tile_ix );
      ctx.drawImage( Images.TILE_IMAGES, img_loc.x, img_loc.y, TILE_WIDTH, TILE_WIDTH,  convert_ix_to_raw_coord( view_pos.x ),  convert_ix_to_raw_coord( view_pos.y ), TILE_WIDTH, TILE_WIDTH );
    }
  };
  
  this.is_visible = function()
  {
    return this.type != SECRET;
  };
  
  this.is_open = function()
  {
    return this.type == OPEN || this.type == BROKEN;
  };
  
  this.is_broken = function()
  {
    return this.type == BROKEN;
  };
  
  this.find = function()
  {
    this.type = CLOSED;
    Log.add( "You found a secret door!" );
  };
  
  this.set_open = function()
  {
    this.type = OPEN;
  };
  
  this.set_closed = function()
  {
    this.type = CLOSED;
  };
  
  this.damage = function()
  {
    this.type = BROKEN;
  };
  
  this.get_tooltip = function()
  {
    if( this.type == SECRET )
    {
      return "";
    }
    else if( this.type == OPEN )
    {
      return "<li>an open door</li>";
    }
    else if( this.type == BROKEN )
    {
      return "<li>a broken door</li>";
    }
    else
    {
      return "<li>a closed door</li>";
    }
  };
};
extend( Door, Serializable );

Door.prototype.load = function( obj )
{
  Room.super_class.load.call( this, obj );
  this.location = Storage.load_point( obj.location );
};

function Texture()
{
  function init_tile_indexes( data, node )
  {
    return data.find( node ).attr("value").split(",");
  }
  
  var data = Loader.get_texture( 1 );   // TODO: change up how we get textures based on level ranges
  this.walls = init_tile_indexes( data, "Walls" );
  this.floor = init_tile_indexes( data, "Floor" );
  this.widgets = init_tile_indexes( data, "Widgets" );
  
  function get_random_index( array )
  {
    return array[random_index(array.length)];
  }
  
  this.get_wall_ix = function()
  {
    return get_random_index( this.walls );
  };
  
  this.get_floor_ix = function()
  {
    return get_random_index( this.floor );
  };

  this.get_widget_id = function()
  {
    return get_random_index( this.widgets );
  };
}

//----------------------------------------------------------------------------------------------
// MAP GENERATOR


function MapGenerator()
{
  this.map = null;
  this.rooms_list = new Array();
  
  this.generate_map = function()
  {
    this.allocate_map();
    this.block_map_edge();
    this.place_rooms();
    this.build_tunnels();
    this.collapse_tunnels();
  };
  
  this.allocate_map = function()
  {
    this.map = new Array();
    
    for( var y = 0; y < MAP_HEIGHT; y++ )
    {
      this.map[y] = new Array();
      
      for( var x = 0; x < MAP_WIDTH; x++ )
      {
        this.map[y][x] = new Cell(); 
      }
    }
  };
  
  this.block_map_edge = function()
  {
    for( var col = 0; col < MAP_WIDTH; col++ )
    {
      this.map[0][col].blocked = true;
      this.map[MAP_HEIGHT-1][col].blocked = true;
    }
    
    for( var row = 0; row < MAP_HEIGHT; row++ )
    {
      this.map[row][0].blocked = true;
      this.map[row][MAP_WIDTH-1].blocked = true;
    }
  };
  
  this.place_rooms = function()
  {
    // Pack Rooms algorithm
    for( var row = 0; row < MAP_HEIGHT/2; row++ )
    {
      for( var col = 0; col < MAP_WIDTH/2; col++ )
      {
        if( this.map[row][col].room_id == -1 && chance( 50 ) )
        {
          var room = new Room();
          room.top_left.x = ( col * 2 ) + 1;
          room.top_left.y = ( row * 2 ) + 1;
          
          if( room.fits_on_map() && !room.contains_any_blocked_cell( this.map ) )
          {
            room.room_id = this.rooms_list.length;
            room.place_room( this.map );
            this.rooms_list.push( room );
            
            var doors = new DoorMaker( this.map, room );
            doors.create_doors();
          }
        }
      }
    }
  };
  
  this.build_tunnels = function()
  {
    var tunnels = new TunnelMaker( this.map );
    tunnels.create_tunnels();
  };
  
  this.collapse_tunnels = function()
  {
    var tunnels = new TunnelCrusher( this.map );
    tunnels.crush_tunnels();
  };
  
// PRELIMINARY CONVERSION FUNCTION
  this.convert_to_tiles = function( level )
  {
    var texture = new Texture();
    
    for( var row = 0; row < MAP_HEIGHT; ++row )
    {
      level.map_tiles[row] = new Array();
      
      for( var col = 0; col < MAP_WIDTH; ++col )
      {
        // Setup the tile we should be drawing here.
        if( this.map[row][col].is_a_room() || this.map[row][col].is_corridor || this.map[row][col].is_entrance )
        {
          level.map_tiles[row][col] = new Tile( texture.get_floor_ix() );  // Floor
          level.map_tiles[row][col].passable = true;
          level.map_tiles[row][col].is_lit = this.map[row][col].is_lit;
        }
        else
        {
          level.map_tiles[row][col] = new Tile( texture.get_wall_ix() ); // Wall          
        }
        
        // Create a door if necessary
        if( this.map[row][col].is_entrance )
        {
          var door_type = chance( 80 ) ? CLOSED : SECRET;
          
          level.map_tiles[row][col].is_entrance = true;
          level.doors.push( new Door( door_type, 3, row, col ) );
        }
        
        level.map_tiles[row][col].room_id = this.map[row][col].room_id;
      }
    }
  };
  
  this.generate_stairs_location = function()
  {
    var room_ix = Math.floor( Math.random() * this.rooms_list.length );
    return this.rooms_list[room_ix].get_random_location();
  };
  
  this.generate_stairs = function( collection, type, num_stairs )
  {
    for( var ix = 0; ix < num_stairs; ++ix )
    {
      var location = null;
      
      // Keep looking for a spot until we find one without stairs
      while( location == null || this.map[location.y][location.x].is_stairs )
      {
        location = this.generate_stairs_location();
      }
      
      if( !this.map[location.y][location.x].is_stairs )
      {
        collection.push( new Widget( type, location ) );
        this.map[location.y][location.x].is_stairs = true;
      }
    }
  };
  
  this.generate_random_location = function()
  {
    return new Point( Math.floor( Math.random() * MAP_HEIGHT ), Math.floor( Math.random() * MAP_WIDTH ) );    
  };
  
  this.generate_traps = function( level, num_traps )
  {
    var num_types = Loader.get_num_traps();
    
    for( var ix = 0; ix < num_traps; ++ix )
    {
      var location = null;
      var attempts = 0;
      
      // Look for a passable tile. Give up after 10 attempts.
      while( attempts < 10 && ( location == null || !level.map_tiles[location.y][location.x].passable ) )
      {
        location = this.generate_random_location();
        attempts++;
      }
      
      // Add a new trap as long as there's nothing here
      var cell = this.map[location.y][location.x];
      if( attempts <= 10 && !cell.trapped && !cell.is_stairs && !cell.is_entrance )
      {
        level.traps.push( new Trap( random_type( num_types ), location ) );
        this.map[location.y][location.x].trapped = true;
      }
    }
  };

  this.is_widget_location_allowed = function( level, location )
  {
    var allowed = false;

    // Is the tile already occupied?
    if( !level.is_location_occupied( location ) )
    {
      allowed = true;

      // Are we adjacent to a visible door?
      for( var ix = 0; ix < level.doors.length; ++ix )
      {
        if( location.adjacent_to( level.doors[ix].location ) )
        {
          allowed = false;
          break;
        }
      }
    }
     
    return allowed;
  };

  this.add_light_source = function( level, room )
  {
    var location = null;
    var attempts = 0;
      
    // Look for a free tile. Give up after 10 attempts.
    while( attempts < 10 && ( location == null || !this.is_widget_location_allowed( level, location ) ) )
    {
      location = room.get_random_location();
      attempts++;
    }

    if( attempts <= 10 )
    {
      var source_ix = random_index(LIGHT_SOURCES.length);
      level.widgets.push( new Widget( LIGHT_SOURCES[source_ix], location ) );
    }
  };

  this.generate_widgets = function( level )
  {
    var texture = new Texture();

    // Consider adding some widgets to each room
    for( var room_ix = 0; room_ix < level.rooms.length; ++room_ix )
    {
      var room = level.rooms[room_ix];

      // If room is already lit, we should always include at least one light source (over and above any other widgets)
      if( room.is_lit )
      {
        this.add_light_source( level, room );
      }

      // 50% chance to add random widgets
      if( chance( 50 ) )
      {
        // Number of widgets based on room size
        // Density is 1 per minimum room size (5x5) of area
        var num_widgets = random_type( room.height * room.width / ( MIN_ROOM_SIZE * MIN_ROOM_SIZE ) );

        for( var ix = 0; ix < num_widgets; ++ix )
        {
          var location = null;
          var attempts = 0;
      
          // Look for a free tile. Give up after 10 attempts.
          while( attempts < 10 && ( location == null || !this.is_widget_location_allowed( level, location ) ) )
          {
            location = room.get_random_location();
            attempts++;
          }

          if( attempts <= 10 )
          {
            level.widgets.push( new Widget( texture.get_widget_id(), location ) );
          }
        }
      }
    }
  };
  
  this.create_new_level = function( level, num_stairs_up )
  {
    this.generate_map();
    this.convert_to_tiles( level );
    level.rooms = this.rooms_list;
    this.generate_stairs( level.stairs_up, STAIRS_UP, num_stairs_up );
    
    var num_stairs_down = Math.floor( this.rooms_list.length / 5 );
    this.generate_stairs( level.stairs_down, STAIRS_DOWN, num_stairs_down );
    
    this.generate_traps( level, this.rooms_list.length );
    this.generate_widgets( level );
  };
}function equipped( obj )
{
  obj.css("border-color", "white");
}

function unequipped( obj )
{
  obj.css("border-color", "blue");
}

function set_border_based_on_container( container, obj )
{
  if( container.hasClass("NonEquipped") )
  {
    unequipped( obj );
  }
  else
  {
    equipped( obj );
  }
}

function Item( stat_id, pos )
{
  Item.base_constructor.call( this );
  this.id        = Item.max_item_id;
  this.stat_id   = stat_id;
  this.slot      = "";
  this.description = "";
  this.location  = null;
  this.icon_id   = null;
  this.doll_id   = null;
  this.legs_id   = null;
  this.equipped  = false;
  var MULTIPLE_IMG = 17;
  
  if( pos != undefined )
  {
    this.location = new Point( pos.x, pos.y );
  }
  
  this.initialize = function()
  {
    var data = Loader.get_item_data( this.stat_id );
    
    this.description = data.find("Description").text();
    this.slot = data.parent()[0].nodeName.toLowerCase();
    this.icon_id = data.attr("img_id");
    this.doll_id = data.attr("doll_id");
    
    // Special case for Rings (can be equipped in multiple slots)
    if( this.slot == "ring" )
    {
      this.slot = "rightring leftring";
    }
    
    // Special case for Chest items. We could have a Leg image to go with it.
    if( this.slot == "chest" )
    {
      this.legs_id = data.attr("legs_id");
    }
  };
  
  if( stat_id != undefined )
  {
    this.initialize();
    Item.max_item_id = Math.max( this.id, Item.max_item_id + 1 );
  }
  
  this.draw = function( ctx )
  {
    if( this.should_draw_item() )
    {
      var view_pos = Map.translate_map_coord_to_viewport( this.location );
      var img_loc = null;

      if( Dungeon.count_items_in_tile( this.location ) > 1 )
      {
        img_loc = convert_tile_ix_to_point( MULTIPLE_IMG );
      }
      else
      {
        img_loc = convert_tile_ix_to_point( this.icon_id );
      }

      ctx.drawImage( Images.ITEM_IMAGES, img_loc.x, img_loc.y, TILE_WIDTH, TILE_WIDTH, convert_ix_to_raw_coord( view_pos.x ), convert_ix_to_raw_coord( view_pos.y ), TILE_WIDTH, TILE_WIDTH );
    }   
  };
  
  this.should_draw_item = function()
  {
    return Map.is_location_visible( this.location ) && Dungeon.is_location_explored( this.location );
  };
  
  this.drop = function( point )
  {
    this.equipped = false;
    this.location = new Point( point.x, point.y );
    Log.add( "You drop " + this.description + "." );
  };
  
  this.take = function()
  {
    this.location = null;
    Log.add( "You pick up " + this.description + "." );
  };
  
  this.get_tooltip = function()
  {
    return "<li>" + this.description + "</li>";
  };
}
extend( Item, Serializable );

Item.prototype.load = function( obj )
{
  Item.super_class.load.call( this, obj );
  this.location = Storage.load_point( obj.location );
};

Item.max_item_id = 0;

function InventoryManager()
{
  this.popup = $("#inventory");
  this.is_open = false;
  
  this.popup.modal({ 
                show: false,
                remote: "html/inventory.html"
          });
  this.popup.on( "show.bs.modal", function() { 
                open_dialog();
                Inventory.is_open = true;
          });
  this.popup.on( "shown.bs.modal", function() {
                Inventory.refresh_ui();
          });
  this.popup.on( "hide.bs.modal", function() { 
                DrawPlayer.construct_paperdoll();
                close_dialog();
                Inventory.is_open = false;
                set_dirty();
                document.game.draw();
          });
  //this.popup.css("margin-left", -415);
  
  this.refresh_ui = function()
  {
    var do_load = this.bag == undefined;
    this.bag   = $("#bag");
    this.floor = $("#floor");
    
    if( do_load )   // Loading a saved game may not have been able to populate bags and slots if the user hadn't opened the Inventory popup yet.
    {
      this.load();
    }
    
    this.floor.empty();
    this.update_floor_items();

    $("#inv_gold").text( (1234567).toCommas() ); // TODO THIS NEEDS TO COME FROM PLAYER
    
    var item_slot_options = { items: ".Item",
                              placeholder: "BlankItemSlot",
                              connectWith: ".ItemContainer",
                              tolerance: "pointer",
                              cursor: "move",
                              receive: function(event, ui) {
                                          var $this = $(this);
                                          if( !ui.item.hasClass( $this.attr("id") ) ) // Doesn't belong in this slot
                                          {
                                            ui.sender.sortable("cancel");
                                            set_border_based_on_container( ui.sender, ui.item );
                                            return;
                                          }
                                          else if( $this.children().length > 1 ) // Already something here, so perform a swap
                                          {
                                            var item = $this.children( "div:not(#" + ui.item[0].id + ")" ).detach();
                                            ui.sender.append( item );
                                            Inventory.move_item_between_collections( item[0].id, $this, ui.sender );
                                            set_border_based_on_container( ui.sender, item );
                                          }
                                          
                                          Inventory.move_item_between_collections( ui.item[0].id, ui.sender, $this );
                                          set_border_based_on_container( $this, ui.item );
                                        },
                              start: function(event, ui) {
                                          unequipped( ui.item );                                                
                                        },
                              stop: function(event, ui) {
                                          set_border_based_on_container( ui.item.parent(), ui.item );
                                        }
                            };
    
    var item_container_options = { items: ".Item",
                                   placeholder: "BlankItemSlot",
                                   connectWith: ".ItemContainer",
                                   tolerance: "pointer",
                                   cursor: "move",
                                   receive: function(event, ui) {
                                              Inventory.move_item_between_collections( ui.item[0].id, ui.sender, ui.item.parent() );
                                      }
                           };
    
    this.bag.sortable( item_container_options );
    this.floor.sortable( item_container_options );
    
    $(".ItemSlot").each( function() {
                 $(this).sortable( item_slot_options );
             });
  };
  
  this.open = function()
  {
    if( !is_processing() )
    {
      this.popup.modal("show");
    }
  };
  
  this.update_floor_items = function()
  {
    var floor_items = Dungeon.get_items_in_tile( Player.location );
    this.update_section_items( this.floor, floor_items );
    floor_items = [];
  };
  
  this.update_section_items = function( section, items )
  {
    if( section == undefined ) return;
    
    for( var ix = 0; ix < items.length; ++ix )
    {
      if( $("#item" + items[ix].id).size() > 0 ) continue;
      
      section.append( this.create_item_box( items[ix] ) );
      this.update_item_box_canvas( items[ix] );

      $("#item" + items[ix].id).dblclick( function() {
                                            var sender_id = $(this).parent().attr("id");
                                            if( sender_id == "floor" || sender_id == "bag" )
                                            {
                                              var sender = $(this).parent();
                                              var receiver = ( sender_id == "floor" ) ? Inventory.bag : Inventory.floor;
                                              $(this).detach().appendTo( receiver );
                                              Inventory.move_item_between_collections( $(this).attr("id"), sender, receiver );
                                            }
                                          });
    } 
  };

  this.update_item_box_canvas = function( item )
  {
    var ctx = $("#item" + item.id + " canvas")[0].getContext("2d");
    var img_loc = convert_tile_ix_to_point( item.icon_id );
    ctx.drawImage( Images.ITEM_IMAGES, img_loc.x, img_loc.y, TILE_WIDTH, TILE_WIDTH, 0, 0, TILE_WIDTH, TILE_WIDTH );
  };
     
  this.create_item_box = function( item )
  {
    var html = "<div id=\"item" + item.id +"\" class=\"Item " + item.slot + "\">";
    html += "<canvas width=\"" + TILE_WIDTH + "\" height=\"" + TILE_WIDTH + "\"></canvas><br/>";
    html += "<h1>" + item.description + "</h1>";
    html += "</div>";
    return html;
  };
  
  this.convert_html_id_to_item_ix = function( item_id, collection )
  {
    return get_element_ix( item_id.replace(/[^\d]/g, ""), collection );
  };
  
  this.take = function( item_id )
  {
    var items = Dungeon.get_items();
    var item_ix = this.convert_html_id_to_item_ix( item_id, items );
    
    if( item_ix > -1 )
    {
      items[item_ix].take();
      Player.bag.push( items[item_ix] );
      Log.debug( "Picking up item" + items[item_ix].id + " from " + Player.location.to_string() );
      items.splice( item_ix, 1 );
    }
  };
  
  this.take_all = function()
  {
    var items = Dungeon.get_items();
    var floor_items = Dungeon.get_items_in_tile( Player.location );
    this.update_section_items( this.floor, floor_items );
    
    for( var i = 0; i < floor_items.length; ++i )
    {
      $("#item" + floor_items[i].id).detach().appendTo( this.bag );
      
      floor_items[i].take();
      Player.bag.push( floor_items[i] );
      Log.debug( "Picking up item" + floor_items[i].id + " from " + Player.location.to_string() );
      items.splice( get_element_ix( floor_items[i].id, items ), 1 );
    }
    
    floor_items = [];
  };
  
  this.drop = function( item_id )
  {
    var items = Dungeon.get_items();
    var item_ix = this.convert_html_id_to_item_ix( item_id, Player.bag );
    
    if( item_ix > -1 )
    {
      Player.bag[item_ix].drop( Player.location ); // Monster drops are handled by direct Item creations
      items.push( Player.bag[item_ix] );
      Player.bag.splice( item_ix, 1 );
      Log.debug( "Dropping " + item_id + " at " + Player.location.to_string() );
    }
  };
  
  this.equip_item = function( item_id, slot )
  {
    var item_ix = this.convert_html_id_to_item_ix( item_id, Player.bag );
    
    if( item_ix > -1 )
    {
      Player.bag[item_ix].equipped = slot;
      Log.debug( "Item " + item_id + " is equipped: " + slot );
    }
  };
  
  this.find_equipped_item_for_slot = function( slot )
  {
    for( var i = 0; i < Player.bag.length; ++i )
    {
      if( Player.bag[i].equipped == slot )
      {
        return Player.bag[i];
      }      
    }
    
    return null;
  };
  
  this.move_item_between_collections = function( item_id, $sender, $receiver )
  {
    var sender_id = $sender.attr("id");
    var receiver_id = $receiver.attr("id");
    
    if( sender_id == "floor" )
    {
      // When the sender is the Floor, it means we are picking up a new item.
      this.take( item_id );
      
      if( receiver_id != "bag" )
      {
        // Any receiver other than the Bag means that an item has been moved into a Slot and therefore is equipped.
        this.equip_item( item_id, receiver_id );
      }
    }
    else
    {
      // Any other sender means we're moving an item that the Player already has in the Bag
      if( receiver_id == "floor" )
      {
        // When the receiver is the Floor, it means we are dropping an item
        this.drop( item_id );
      }
      else if( receiver_id == "bag" )
      {
        // When the receiver is the Bag, it means we are unequipping an item
        this.equip_item( item_id, "" );
      }
      else
      {
        // Any other receiver means we're swapping two equipped items (i.e. Rings)
        this.equip_item( item_id, receiver_id );
      }
    }
  };
  
  this.load = function()
  {
    if( this.bag != undefined )
    {
      this.bag.empty();
      this.update_section_items( this.bag, Player.bag );
      
      $(".ItemSlot").each( function() {
                   var $this = $(this);
                   $this.empty();
                   var item = Inventory.find_equipped_item_for_slot( $this.attr("id") );
                   if( item )
                   {
                     var $item_div = $("#item" + item.id);
                     $item_div.detach().appendTo( $this );
                     equipped( $item_div );
                   }
               });
    }
  };
}function Paperdoll()
{
  var BASE_PLAYER_IMAGE = 0;
  
  this.layer_order = [ "back", "base", "chest", "feet", "hat", "hands", "weapon", "shield" ];
  
  this.buffer = document.createElement("canvas");
  this.buffer.width = TILE_WIDTH;
  this.buffer.height = TILE_WIDTH;
  this.buffer_ctx = this.buffer.getContext("2d");
  
  this.draw = function( ctx )
  {
    var view_pos = Map.translate_map_coord_to_viewport( Player.location );
    ctx.drawImage( this.buffer, convert_ix_to_raw_coord( view_pos.x ), convert_ix_to_raw_coord( view_pos.y ) );
    delete view_pos;
  };
  
  this.construct_paperdoll = function()
  {
    this.buffer_ctx.clearRect( 0, 0, this.buffer.width, this.buffer.height );
    
    for( var i = 0; i < this.layer_order.length; ++i )
    {
      if( this.layer_order[i] == "base" )
      {
        this.buffer_ctx.drawImage( Images.PAPERDOLL_IMAGES, 0, 0, TILE_WIDTH, TILE_WIDTH, 0, 0, TILE_WIDTH, TILE_WIDTH );
      }
      else
      {
        this.apply_layer( Inventory.find_equipped_item_for_slot( this.layer_order[i] ) );
      }
    }
  };
  
  this.apply_layer = function( item )
  {
    if( item )
    {
      var img_loc = null;

      if( item.slot == "chest" && item.legs_id )  // Some armour also needs to draw legs.
      {
        img_loc = convert_tile_ix_to_point( item.legs_id );
        this.buffer_ctx.drawImage( Images.PAPERDOLL_IMAGES, img_loc.x, img_loc.y, TILE_WIDTH, TILE_WIDTH, 0, 0, TILE_WIDTH, TILE_WIDTH );
      }
      
      img_loc = convert_tile_ix_to_point( item.doll_id );
      this.buffer_ctx.drawImage( Images.PAPERDOLL_IMAGES, img_loc.x, img_loc.y, TILE_WIDTH, TILE_WIDTH, 0, 0, TILE_WIDTH, TILE_WIDTH );
    }
  };
  
  this.get_data_url = function()
  {
    return this.buffer.toDataURL();
  };

}function Level()
{
  Level.base_constructor.call( this );
  this.map_tiles = new Array();
  this.monsters = new Array();
  this.items = new Array();
  this.rooms = new Array();
  this.doors = new Array();
  this.stairs_up = new Array();
  this.stairs_down = new Array();
  this.traps = new Array();
  this.widgets = new Array();
  this.level_ix = null;
  
  this.create_single_monster = function( monster_type, location )
  {
    var monster = new Monster( monster_type );
    monster.move_to( location );
    this.monsters.push( monster );
  };
  
  this.create_single_item = function( stat_id, point )
  {
    var item = new Item( stat_id, point );
    this.items.push( item );
  };
    
  this.get_monster_ix = function( monster_id )
  {
    return get_single_item_ix_by_id( this.monsters, monster_id );
  };
  
  this.get_trap_ix = function( location )
  {
    return get_single_item_ix_by_location( this.traps, location );
  };
  
  this.get_monster_in_tile = function( location )
  {
    return get_single_item_at_location( this.monsters, location );
  };
  
  this.get_trap_in_tile = function( location )
  {
    return get_single_item_at_location( this.traps, location );
  };

  this.get_widget_in_tile = function( location )
  {
    return get_single_item_at_location( this.widgets, location );
  };
  
  this.get_stair_ix_at_location = function( collection, location )
  {
    return get_single_item_ix_by_location( collection, location );
  };

  this.is_location_occupied = function( location )
  {
    return this.get_trap_in_tile( location ) != null
        || this.get_widget_in_tile( location ) != null
        || this.get_stair_ix_at_location( this.stairs_up, location ) != -1
        || this.get_stair_ix_at_location( this.stairs_down, location ) != -1
        ;
  };
  
  this.get_starting_location = function( stair_ix )
  {
    if( this.stairs_up.length == 0 || stair_ix > this.stairs_up.length )
    {
      var room_ix = Math.floor( Math.random() * this.rooms.length );
      return this.rooms[room_ix].get_room_center();
    }
    else
    {
      return this.stairs_up[stair_ix].location;
    }
  };
  
  this.get_exit_location = function( stair_ix )
  {
    return this.stairs_down[stair_ix].location;
  };
  
  function get_random_monster_quality()
  {
    var quality_chance = random_type( 100 );
    
    if( quality_chance > 40 )
    {
      return "common";
    }
    else if( quality_chance > 10 )
    {
      return "uncommon";
    }
    else
    {
      return "rare";
    }
  }
  
  function get_random_monster_type( level_ix )
  {
    var type = Number.NaN;
    
    // Keep trying until we find a monster type for this level (sometimes we might come up with a Quality that isn't defined for this level)
    while( isNaN( type ) )
    {
      var quality = get_random_monster_quality();
      var data = Loader.get_monsters_suitable_for_level( level_ix ).filter( function() {
                              return Loader.get_monster_quality_for_level( $(this), level_ix ) == quality;
                           });

      type = parseInt( data.eq( random_type( data.length ) - 1 ).attr("id") );
    }
    
    return type;
  }
    
  this.spawn_monster = function()
  {
    var room_ix = -1;
    var location = null;
    
     // Keep trying for random room/location combinations until we find an open spot (monsters can't spawn ontop of other monsters!)
    while( room_ix == -1 || this.get_monster_in_tile( location ) != null )
    {
      room_ix = Math.floor( Math.random() * this.rooms.length );
      location = this.rooms[room_ix].get_random_location();
    }
    
    this.create_single_monster( get_random_monster_type( this.level_ix ), location );
  };
  
  this.initialize = function( num_stairs_up )
  {
    var mapgen = new MapGenerator();
    mapgen.create_new_level( this, num_stairs_up );
    
    // Spawn monsters (start with one per room)
    for( var monster_ix = 0; monster_ix < this.rooms.length; ++monster_ix )
    {
      this.spawn_monster();
    }
  };
}
extend( Level, Serializable );

Level.prototype.load = function( obj )
{
  this.map_tiles = Storage.load_map( obj.map_tiles );
  this.monsters = Storage.load_collection( obj.monsters, Monster );
  this.items = Storage.load_collection( obj.items, Item );
  this.rooms = Storage.load_collection( obj.rooms, Room );
  this.doors = Storage.load_collection( obj.doors, Door );
  this.stairs_up = Storage.load_collection( obj.stairs_up, Widget );
  this.stairs_down = Storage.load_collection( obj.stairs_down, Widget );
  this.traps = Storage.load_collection( obj.traps, Trap );
  this.widgets = Storage.load_collection( obj.widgets, Widget );
};

function DungeonManager()
{
  this.level_ix = 0;
  this.levels = new Array();
  
  this.create_level = function( num_stairs_up )
  {
    var new_level = new Level();
    new_level.level_ix = this.levels.length + 1;
    new_level.initialize( num_stairs_up );
    
    if( this.levels.length == 0 ) // Top level of the dungeon doesn't have stairs up YET
    {
      new_level.stairs_up.length = 0;
    }
    
    this.levels.push( new_level );
  };
  
  this.update_level = function()
  {
    $("#level").text( this.level_ix + 1 );
  };
  
  this.get_current_level = function()
  {
    return this.levels[this.level_ix];
  };
  
  this.get_map_tiles = function()
  {
    return this.levels[this.level_ix].map_tiles;
  };
  
  this.get_items = function()
  {
    return this.levels[this.level_ix].items;
  };
  
  this.get_monsters = function()
  {
    return this.levels[this.level_ix].monsters;
  };
  
  this.is_location_lit = function( location )
  {
    return this.levels[this.level_ix].map_tiles[location.y][location.x].is_lit;
  };
  
  this.is_location_lit_unexplored = function( location )
  {
    return this.levels[this.level_ix].map_tiles[location.y][location.x].is_lit_unexplored();
  };
  
  this.is_location_explored = function( location )
  {
    return this.levels[this.level_ix].map_tiles[location.y][location.x].explored;
  };
  
  this.move_monsters = function()
  {
    if( !FREEZE_MONSTERS )
    {
      for( var i = 0; i < this.levels[this.level_ix].monsters.length; ++i )
      {
        this.levels[this.level_ix].monsters[i].do_move();
      }
    }
  };
  
  this.get_monster_in_tile = function( location )
  {
    return this.get_current_level().get_monster_in_tile( location );
  };
  
  this.get_trap_in_tile = function( location )
  {
    return this.get_current_level().get_trap_in_tile( location );
  };

  this.get_widget_in_tile = function( location )
  {
    return this.get_current_level().get_widget_in_tile( location );
  };
  
  this.trigger_traps_in_tile = function( location )
  {
    var trap = this.get_current_level().get_trap_in_tile( location );
    if( trap )
    {
      trap.trigger();
    }
  };
  
  this.kill_monster = function( monster_id )
  {
    var level = this.get_current_level();
    level.monsters.splice( level.get_monster_ix( monster_id ), 1 );
  };
  
  this.get_monster_by_id = function( monster_id )
  {
    for( var ix = 0; ix < this.levels.length; ++ix )
    {
      var monster_ix = this.levels[ix].get_monster_ix( monster_id );
      
      if( monster_ix != -1 )
      {
        return this.levels[ix].monsters[monster_ix]; 
      }
    }
    
    return null;
  };
  
  this.disarm_trap = function( trap_id )
  {
    var level = this.get_current_level();
    level.traps.remove( level.get_trap_ix( trap_id ) );
  };
  
  this.get_items_in_tile = function( point )
  {
    var loot = new Array();
    var level = this.get_current_level();
    
    for( var i = 0; i < level.items.length; ++i )
    {
      if( level.items[i].location.equals( point ) )
      {
        loot.push( level.items[i] );
      }
    }
    
    return loot;
  };
  
  this.count_items_in_tile = function( point )
  {
    var num = 0;
    var level = this.get_current_level();
    
    for( var i = 0; i < level.items.length; ++i )
    {
      if( level.items[i].location.equals( point ) )
      {
        num++;
      }
    }
    
    return num;
  };
  
  this.explore_at_location = function( point )
  {
    var map_tiles = this.get_map_tiles();
    var tile = map_tiles[point.y][point.x];
    
    if( tile.is_lit_room() )
    {
      this.update_room_tiles( map_tiles, tile.room_id, explore_tile );
    }
    else
    {
      this.update_adjacent_tiles( map_tiles, point, explore_tile );
    }
  };
  
  this.update_adjacent_tiles = function( map_tiles, point, callback )
  {
    for( var row = point.y - 1; row <= point.y + 1; ++row )
    {
      for( var col = point.x - 1; col <= point.x + 1; ++col )
      {
        if( row >= 0 && row < map_tiles.length && col >= 0 && col < map_tiles[0].length )
        {
          callback( map_tiles, row, col );
        }
      }
    }
  };
  
  this.update_room_tiles = function( map_tiles, room_id, callback )
  {
    var room = this.get_current_level().rooms[room_id];
    
    for( var row = room.top_left.y - 1; row <= room.top_left.y + room.height; ++row )
    {
      for( var col = room.top_left.x - 1; col <= room.top_left.x + room.width; ++col )
      {
        callback( map_tiles, row, col );
      }
    }
  };
  
  function search_collection_at_location( collection, location )
  {
    for( var ix = 0; ix < collection.length; ++ix )
    {
      if( location.adjacent_to( collection[ix].location ) && !collection[ix].is_visible() )
      {
        collection[ix].find(); // TODO incorporate some kind of skill check here
      }
    }
  }
  
  this.search_at_location = function( location )
  {
    var level = this.get_current_level();
    search_collection_at_location( level.doors, location );
    search_collection_at_location( level.traps, location );
  };
  
  this.get_door_in_tile = function( location )
  {
    var level = this.get_current_level();
    return get_single_item_at_location( level.doors, location );
  };

  this.go_down = function( stair_ix )
  {
    if( this.level_ix + 2 > this.levels.length )
    {
      this.create_level( this.levels[this.level_ix].stairs_down.length );
    }
    
    this.level_ix++;
    Player.location.assign( this.levels[this.level_ix].get_starting_location( stair_ix ) ); // Start at the Stairs UP corresponding to the Stairs DOWN that were just used
  };
  
  this.go_up = function( stair_ix )
  {
    this.level_ix--;
    Player.location.assign( this.levels[this.level_ix].get_exit_location( stair_ix ) ); // Start at the Stairs DOWN corresponding to the Stairs UP that were just used
  };
}
extend( DungeonManager, Serializable );

DungeonManager.prototype.load = function( obj )
{
  DungeonManager.super_class.load.call( this, obj );
  this.levels = Storage.load_collection( obj.levels, Level );
};

// Callbacks for affecting map tiles in various ways
function explore_tile( map_tiles, row, col )
{
  map_tiles[row][col].explored = true;
}

function light_tile( map_tiles, row, col )
{
  map_tiles[row][col].is_lit = true;
}function perform_action( action )
{
  if( !is_processing() )
  {
    if( get_command() != NO_COMMAND )
    {
      cancel_action();
    }
    
    if( is_targeted_action( action ) )
    {
      crosshairs_cursor();
      set_command( action );
      toggle_action();
    }
    else
    {
      handle_action( action );
    }
  }
}

function toggle_action()
{
  $("#btn_" + get_command()).button("toggle");
}

function cancel_action()
{
  toggle_spell( SpellBar.get_button_ix( get_command() ) );
  toggle_action();
  set_command( NO_COMMAND );
  default_cursor();
}

function is_action( action )
{
  return action == "search" || action == "open" || action == "close" || action == "rest" || action == "sleep" || action == "down" || action == "up" || action == "disarm";
}

function is_targeted_action( action )
{
  return action == "open" || action == "close" || action == "disarm";
}

function handle_action( action, location )
{
  var is_valid = false;
  
  if( action == "search" )
  {
    do_search();
    is_valid = true;
  }
  else if( action == "open" )
  {
    is_valid = do_open( location );
    set_finished();
  }
  else if( action == "close" )
  {
    is_valid = do_close( location );
    set_finished();
  }
  else if( action == "rest" )
  {
    do_rest();
    is_valid = true;
  }
  else if( action == "sleep" )
  {
    do_sleep();
    is_valid = true;
  }
  else if( action == "down" )
  {
    is_valid = go_down();
  }
  else if( action == "up" )
  {
    is_valid = go_up();
  }
  else if( action == "disarm" )
  {
    is_valid = do_disarm( location );
    set_finished();
  }
  else if( action == "take" )
  {
    Inventory.take_all();
    document.game.draw();
    is_valid = true;
  }
  
  return is_valid;  
}

function do_search()
{
  if( attempt_long_action( ROUNDS_IN_ONE_MIN ) == ROUNDS_IN_ONE_MIN )
  {
    Dungeon.search_at_location( Player.location );
    document.game.do_turn();
  }
}

function do_open( location )
{
  if( location.adjacent_to( Player.location ) )
  {
    var door = Dungeon.get_door_in_tile( location );
    
    if( door && door.is_visible() && !door.is_open() )
    {
      door.set_open();
      Log.add( "You open the door." );
      Time.add_time( TIME_STANDARD_MOVE );
      return true;
    }
    else
    {
      Log.add( "Nothing to open." );
    }
  }
  else
  {
    Log.add( "You cannot reach that!" );
  }
  
  return false;
}

function do_close( location )
{
  if( location.adjacent_to( Player.location ) )
  {
    var door = Dungeon.get_door_in_tile( location );
    
    if( door && door.is_visible() && door.is_open() && !door.is_broken() )
    {
      // Check for something blocking the door the would prevent us from closing it.
      var target_item = Map.get_target_item_in_tile( location );
      
      if( target_item && target_item.is_monster  )
      {
        Log.add( "The " + target_item.description + " is blocking the door!" );
      }
      else if( Dungeon.count_items_in_tile( location ) > 0 )
      {
        Log.add( "There are objects blocking the door." );
      }
      else
      {  
        door.set_closed();
        Log.add( "You close the door." );
        Time.add_time( TIME_STANDARD_MOVE );
        return true;
      }
    }
    else
    {
      Log.add( "Nothing to close." );
    }
  }
  else
  {
    Log.add( "You cannot reach that!" );
  }
  
  return false;
}

function do_rest()
{
  // We will heal by simply waiting. Player regenerates 1 HP every minute
  attempt_long_action( ( Player.max_hp - Player.current_hp ) * ROUNDS_IN_ONE_MIN );
}

function do_sleep()
{
  // We regenerate mana by attempting to sleep for 8 hours. 
  // If we are interrupted at any point, we will have regenerated a percentage of mana based on how much of the 8 hours we slept 
  var mana_to_regen = Player.max_mana - Player.current_mana;
  
  if( mana_to_regen > 0 )
  {
    var slept = attempt_long_action( 4800 );
    var mana_regained = Math.floor( mana_to_regen * slept / 4800 );
    Player.regen_mana( mana_regained );
    Player.update_mana();
  }
}

function attempt_long_action( rounds )
{
  var attempt = rounds;
  
  for( var ix = 0; ix < rounds; ++ ix )
  {
    var hp_at_start = Player.current_hp;
    Time.add_time( TIME_STANDARD_MOVE );
    document.game.update();
    StatusEffects.run_effects( Time );
    
    if( is_interrupted( hp_at_start ) )
    {      
      Log.add( "You are interrupted!" );
      attempt = ix;
      break;
    }
  }
  
  Time.update_time();
  document.game.draw();
  document.game.draw_spells();
  return attempt;
}

function is_interrupted( hp_at_start )
{
  // Check for adjacent monsters
  var monsters = Dungeon.get_monsters();
  for( var ix = 0; ix < monsters.length; ++ ix )
  {
    if( monsters[ix].location.adjacent_to( Player.location ) )
    {
      return true;
    }
  }
  
  // If the animation queue is not empty, it means a monster cast a spell at the Player
  if( document.game.animation_queue.length > 0 )
  {
    return true;
  }
  
  // Player took damage from some source during this turn
  if( Player.current_hp < hp_at_start )
  {
    return true;
  }
  
  return false;
}

function go_down()
{
  var level = Dungeon.get_current_level();
  var stair_ix = level.get_stair_ix_at_location( level.stairs_down, Player.location );
  
  if( stair_ix != -1 )
  {
    Dungeon.go_down( stair_ix );
    change_level();
    return true;
  }
  else
  {
    Log.add( "No stairs down here." );
  }
  
  return false;
}

function go_up()
{
  var level = Dungeon.get_current_level();
  var stair_ix = level.get_stair_ix_at_location( level.stairs_up, Player.location );
  
  if( stair_ix != -1 )
  {
    Dungeon.go_up( stair_ix );
    change_level();
    return true;
  }
  else
  {
    Log.add( "No stairs up here." );
  }
  
  return false;
}

function change_level()
{
  Dungeon.explore_at_location( Player.location );
  Map.center_map_on_location( Player.location );
  Time.add_time( TIME_STANDARD_MOVE );
  Time.update_time();
  Dungeon.update_level();
  document.game.draw();
}

function do_disarm( location )
{
  if( location.adjacent_to( Player.location ) )
  {
    var trap = Dungeon.get_trap_in_tile( location );
    
    if( trap && trap.is_visible() && !trap.tripped )
    {
      // Check for something blocking the trap the would prevent us from disarming it.
      var target_item = Map.get_target_item_in_tile( location );
      
      if( target_item && target_item.is_monster  )
      {
        Log.add( "The " + target_item.description + " is blocking you from doing that!" );
      }
      else if( attempt_long_action( ROUNDS_IN_ONE_MIN ) == ROUNDS_IN_ONE_MIN )
      {
        Dungeon.disarm_trap( trap.location );
        Log.add( "You disarm the " + trap.description + "." );
        document.game.do_turn();
        return true;
      }
    }
    else
    {
      Log.add( "Nothing to disarm." );
    }
  }
  else
  {
    Log.add( "You cannot reach that!" );
  }
  
  return false;
}function Widget( stat_id, pos )
{
  Widget.base_constructor.call( this );
  this.stat_id = stat_id;  
  this.location = null;
  this.frame_ix = 0;
  this.passable = true;
  this.speed = 0;
  this.speed_counter = 0;
  
  if( pos != undefined )
  {
    this.location = new Point( pos.x, pos.y );
  }
  
  if( stat_id != undefined )
  {
    var data = Loader.get_widget_data( this.stat_id );
    this.description = data.find("Description").text();
    this.passable = ( parseInt( data.find("Passable").text() ) == 1 );

    this.tile_id = data.attr("tile_id").split(",");

    if( this.tile_id.length > 1 )
    {
      this.frame_ix = Math.floor( Math.random() * this.tile_id.length );
      this.speed = parseInt( data.find("Speed").text() );
    }
  }
    
  this.draw = function( ctx, increment_frame )
  {
    if( this.should_draw_widget() )
    {
      var view_pos = Map.translate_map_coord_to_viewport( this.location );
      var img_loc = convert_tile_ix_to_point( this.tile_id[this.frame_ix] );
      ctx.drawImage( Images.TILE_IMAGES, img_loc.x, img_loc.y, TILE_WIDTH, TILE_WIDTH,  convert_ix_to_raw_coord( view_pos.x ),  convert_ix_to_raw_coord( view_pos.y ), TILE_WIDTH, TILE_WIDTH );

      if( increment_frame )
      {
        this.advance_frame();
      }
    }
  };
  
  this.get_tooltip = function()
  {
    if( this.should_show_tooltip() )
    {
      return this.get_tooltip_text();
    }
    else
    {
      return "";
    }
  };
}
extend( Widget, Serializable );

Widget.prototype.should_draw_widget = function()
{
  return this.location != null && Map.is_location_visible( this.location ) && Dungeon.is_location_explored( this.location );
};

Widget.prototype.should_show_tooltip = function()
{
  return true;
};

Widget.prototype.get_tooltip_text = function()
{
  return "<li>" + this.description + "</li>";
};

Widget.prototype.advance_frame = function()
{
  if( this.tile_id.length > 1 )
  {
    this.speed_counter++;

    if( this.speed_counter >= this.speed )
    {
      this.speed_counter = 0;
      this.frame_ix++;

      if( this.frame_ix >= this.tile_id.length )
      {
        this.frame_ix = 0;
      }
    }
  }
}

Widget.prototype.load = function( obj )
{
  Widget.super_class.load.call( this, obj );
  this.location = Storage.load_point( obj.location );
};function Minimap()
{
  this.popup = $("#minimap_popup");
  this.map_ctx = null;
  this.buffer = null;
  this.buffer_ctx = null;
  
  Log.debug("Initializing Mini-map...");
  
  this.popup.modal({ show: false });
  this.popup.on( "show.bs.modal", function() { 
                open_dialog();
                Minimap.draw_map();
          });
  this.popup.on( "hide.bs.modal", close_dialog );
      
  var canvas = $("#minimap");
  
  if( canvas && canvas[0].getContext )
  {
    this.map_ctx = canvas[0].getContext("2d");
    this.buffer = document.createElement("canvas");
    this.buffer.width = canvas[0].width;
    this.buffer.height = canvas[0].height;
    this.buffer_ctx = this.buffer.getContext("2d");
    this.buffer_ctx.scale( 0.375, 0.375 );      
  }
  
  Log.debug("Done.");
  
  this.open = function()
  {
    if( !is_processing() )
    {
      this.popup.modal("show");
    }
  };
  
  this.draw_map = function()
  {
    var orig_width = VIEWPORT_WIDTH;
    var orig_height = VIEWPORT_HEIGHT;
    var orig_top_left = new Point();
    orig_top_left.assign( Map.top_left );
    
    // Resize the viewport to trick it into drawing the entire map
    VIEWPORT_WIDTH = MAP_WIDTH;
    VIEWPORT_HEIGHT = MAP_HEIGHT;
    Map.top_left = new Point();
    
    document.game.draw_map( this.buffer_ctx );
    this.map_ctx.drawImage( this.buffer, 0, 0 );
     
    VIEWPORT_WIDTH = orig_width;
    VIEWPORT_HEIGHT = orig_height;
    Map.top_left.assign( orig_top_left );
  };
}function Trap( stat_id, pos )
{
  Trap.base_constructor.call( this, undefined, undefined );
  this.stat_id = stat_id;
  this.found = false;
  this.tripped = false;
  
  if( pos != undefined )
  {
    this.location = new Point( pos.x, pos.y );
    
    var data = Loader.get_trap_data( this.stat_id );
    this.tile_id = [].concat( data.attr("tile_id") );
    this.description = data.find("Description").text();
    this.damage = data.find("Damage").text();
    this.reset = data.find("Reset").text();
  }
  
  this.is_visible = function()
  {
    return this.found;
  };
  
  this.find = function()
  {
    this.found = true;
    Log.add( "You have uncovered a trap!" );
  };
  
  this.trigger = function()
  {
    if( !this.found || this.reset == "1" || !this.tripped )
    {
      this.found = true;
      Player.damage( this.damage );
      Log.add( "You have triggered a " + this.description + "!" );
      
      if( this.reset == "0" )
      {
        this.tripped = true;
        this.description = "tripped " + this.description;
      }
    }
  };
  
}
extend( Trap, Widget );

Trap.prototype.should_draw_widget = function()
{
  return this.found && Trap.super_class.should_draw_widget.call( this );
};

Trap.prototype.should_show_tooltip = function()
{
  return this.found;
};

Trap.prototype.get_tooltip_text = function()
{
  return "<li>a " + this.description + "</li>";
};

Trap.prototype.load = function( obj )
{
  Trap.super_class.load.call( this, obj );
  this.location = Storage.load_point( obj.location );
};function CustomizeSpellsDialog()
{
  this.popup = $("#customize_spells");
  
  this.popup.modal({ 
                show: false,
                remote: "html/spellbook.html"
          });
  this.popup.on( "show.bs.modal", open_dialog );
  this.popup.on( "shown.bs.modal", function() {
                CustomizeSpellBar.refresh_ui();
          });
  this.popup.on( "hide.bs.modal", close_dialog );
  
  function fill_combos()
  {
    $("#customize_spells select").empty().each( function() {
          $("<option>").text("").appendTo( this );
        });
   
    for( var ix = 0; ix < Player.spellbook.length; ++ix )
    {
      var xml = Loader.get_spell_data( Player.spellbook[ix] );
      var description = xml.find("Description").text();
      
      $("#customize_spells select").each( function() {
          $("<option>").val( Player.spellbook[ix] ).text( description ).appendTo( this );
        });
    } 
  }
  
  function load_combo_values()
  {
    $("#customize_spells select")
        .each( function( ix ) {
          $(this).val( SpellBar.spell_list[ix] );
        })
        .trigger("liszt:updated")
        .attr( "data-placeholder", "Select a spell..." )
        .chosen({
              allow_single_deselect: true
        });
  }
  
  function validate_selections()
  {
    var valid = true;
    var spells = [];
    
    $("#customize_spells select").each( function( ix ) {
          var value = $(this).val();
          if( value != "" )
          {
            if( spells.indexOf( value ) == -1 )
              spells.push( value );
            else
              valid = false;
          }
        });
          
    return valid;
  }
  
  this.refresh_ui = function()
  {
    $("#dup_spells").hide();
    fill_combos();
    load_combo_values();
  };
  
  this.save = function()
  {
    if( validate_selections() )
    {
      $("#customize_spells select").each( function( ix ) {
            SpellBar.spell_list[ix] = $(this).val();
          });
      return true;
    }
    else
    {
      $("#dup_spells").show();
      return false;
    }
  };

  this.ok = function()
  {
    if( this.save() )
    {
      SpellBar.update_toolbar();
      set_dirty();
      this.popup.modal("hide");
    }
  };
}var MAX_STAT = 20;
var MIN_STAT = 6;
var DEFAULT_STAT = 8;

function set_value_on_bar( bar, value )
{
  bar.css( "height", ( value / MAX_STAT * 100 ) + "%" );
}

function get_bar_value( bar )
{
  return parseInt( bar.css( "height" ) ) / 100 * MAX_STAT;
}

function assign_player_stat( bar, stat )
{
  var value = get_bar_value( bar );
  Player.stats[stat].base_value = Player.stats[stat].current_value = value;
}

function NewGameDialog()
{
  this.popup = $("#new_game");
  this.popup.modal({ 
                show: false,
                remote: "html/new_game.html"
          });
  this.popup.on( "show.bs.modal", open_dialog );
  this.popup.on( "shown.bs.modal", function() {
                NewGame.refresh_ui();
          });
  this.popup.on( "hide.bs.modal", close_dialog );
  
  this.refresh_ui = function()
  {
    this.pool_bar = $("#ng_pool");
    this.str_bar = $("#ng_str");
    this.int_bar = $("#ng_int");
    this.dex_bar = $("#ng_dex");
    this.con_bar = $("#ng_con");
    this.name = $("#ng_name");
    this.spells = $("#ng_spells");
    this.error = $("#ng_error");
    
    this.initialize();
  };
  
  this.initialize = function()
  {
    this.known_spells = [];
    this.pool = 10;
    set_value_on_bar( this.pool_bar, this.pool );
    set_value_on_bar( this.str_bar, DEFAULT_STAT );
    set_value_on_bar( this.int_bar, DEFAULT_STAT );
    set_value_on_bar( this.dex_bar, DEFAULT_STAT );
    set_value_on_bar( this.con_bar, DEFAULT_STAT );
    
    this.name.val("");
    this.error.hide();
    this.fill_combos();
    
    this.spells.chosen();
    
    $(".plus").click( function( evt ) {
        NewGame.plus( $(this).attr("stat") );
        evt.stopPropagation();
      });
    
    $(".minus").click( function( evt ) {
        NewGame.minus( $(this).attr("stat") );
        evt.stopPropagation();
      });
  };
  
  this.fill_combos = function()
  {
    var spells = this.spells;
    var xml = Loader.get_data_by_level( "Spell", 1 );
    
    spells.empty().append( $("<option>").text("") );
     
    xml.each( function() {
        var $this = $(this);        
        $("<option>").text( $this.find("Description").text() ).val( $this.attr("id") ).appendTo( spells );
      });
  };
  
  this.get_bar = function( bar_id )
  {
    switch( bar_id )
    {
      case "str": return this.str_bar;
      case "int": return this.int_bar;
      case "dex": return this.dex_bar;
      case "con": return this.con_bar;
    }
  };
  
  this.plus = function( bar_id )
  {
    var bar = NewGame.get_bar( bar_id );
    var value = get_bar_value( bar );
    
    if( NewGame.pool > 0 && value < MAX_STAT )
    {
      NewGame.pool--;
      set_value_on_bar( NewGame.pool_bar, NewGame.pool );
      set_value_on_bar( bar, value + 1 );
    }
  };
  
  this.minus = function( bar_id )
  {
    var bar = NewGame.get_bar( bar_id );
    var value = get_bar_value( bar );
    
    if( NewGame.pool <= MAX_STAT && value > MIN_STAT ) // Don't let the user go below the min stat value
    {
      NewGame.pool++;
      set_value_on_bar( NewGame.pool_bar, NewGame.pool );
      set_value_on_bar( bar, value - 1 );
    }
  };
  
  this.validate = function()
  {
    if( $.trim( this.name.val() ) == "" )
    {
      this.error.text("You must enter a name.").show();
      return false;
    }
    
    if( this.pool != 0 )
    {
      this.error.html("You must assign all remaining points to Strength, Intelligence,<br/>Dexterity and Constitution.").show();
      return false;
    }
    
    if( this.known_spells.length != 3 )
    {
      this.error.text("You must choose three spells to learn.").show();
      return false;
    }
    
    if( document.game.dirty && Player != null && !confirm( "You are currently in a game. Any unsaved progress will be lost.\n\nDo you want to continue?" ) )
    {
      return false;
    }
    
    return true;
  };
  
  this.update_known_spells = function()
  {
    var known_spells = this.known_spells = [];
    
    $("#ng_spells option:selected").each( function() {
        known_spells.push( $(this).val() );
      });
  };
  
  this.ok = function()
  { 
    this.update_known_spells();
    
    if( this.validate() )
    {
      Player = new PlayerActor();
      Player.description = this.name.val();
      Player.spellbook = this.known_spells.slice();
      assign_player_stat( this.str_bar, STR );
      assign_player_stat( this.int_bar, INT );
      assign_player_stat( this.dex_bar, DEX );
      assign_player_stat( this.con_bar, CON );
      
      default_inventory();
      
      SpellBar.update_list( this.known_spells );
      
      document.game.bind_events();
      document.game.create_new_game();
      this.popup.modal("hide");
    }
  };
  
  this.open = function()
  {
    this.popup.modal("show");
  };
}

function default_inventory()
{
  // Puny Dagger (equipped)
  var weapon = new Item("weapon1");
  weapon.equipped = "weapon";
  Player.bag.push( weapon );
}var BASE_STAT_BAR = 0;
var CUR_STAT_BAR  = 1;

function CharacterInfoDialog()
{
  this.popup = $("#char_info");
  this.popup.modal({ 
                show: false,
                remote: "html/character_info.html"
          });
  this.popup.on( "show.bs.modal", open_dialog );
  this.popup.on( "shown.bs.modal", function() {
                CharInfo.refresh_ui();
          });
  this.popup.on( "hide.bs.modal", close_dialog );
  
  function set_value_on_bar( bar, stat )
  {
    $("#ci_" + bar + "_base").css( "height", ( Player.stats[stat].base_value / MAX_STAT * 100 ) + "%" );
    $("#ci_" + bar + "_current").css( "height", ( Player.stats[stat].current_value / MAX_STAT * 100 ) + "%" );
  }
  
  this.refresh_ui = function()
  {
    set_value_on_bar( "str", STR );
    set_value_on_bar( "int", INT );
    set_value_on_bar( "dex", DEX );
    set_value_on_bar( "con", CON );
    
    var max_xp = 123456;
    var xp_pct = Math.round( Player.xp / max_xp * 100 ) + "%" ;
    $("#ci_xp").text( Player.xp.toCommas() + "/" + max_xp.toCommas() );
    $("#xp_bar").css( "width", xp_pct ).attr( "title", xp_pct );
    
    $("#ci_img").attr("src", DrawPlayer.get_data_url() );
    $("#ci_name").text( Player.description );
    $("#ci_lvl").text( Player.level );
    Player.update_hp("ci_hp");
    Player.update_mana("ci_mana");
    $("#ci_ac").text( Player.ac );
    $("#ci_gold").text( (1234567).toCommas() ); // TODO THIS NEEDS TO COME FROM PLAYER
    $("#ci_time").text( Time.get_time() );
  };
}var STATUS_EFFECT_TYPE_POISON = 0;
var STATUS_EFFECT_TYPE_PASSIVE_BUFF = 1;
var STATUS_EFFECT_TYPE_PASSIVE_DEBUFF = 2;

function StatusEffectsManager()
{
  this.effects = [];
  
  function get_label_color( type )
  {
    switch( type )
    {
      case STATUS_EFFECT_TYPE_POISON:         return "label-success";
      case STATUS_EFFECT_TYPE_PASSIVE_DEBUFF: return "label-danger";
      case STATUS_EFFECT_TYPE_PASSIVE_BUFF: 
      default:                                return "label-info";
    };
  }
  
  function create_label( div, effect )
  {
    $(div).prepend( "<div id=\"effect" + effect.id + "\" class=\"label " + get_label_color( effect.type ) + "\">" + effect.description + "</div>" ); 
  }
  
  this.add_effect_no_start = function( effect )
  {
    this.effects.unshift( effect );
    
    if( effect.target_id == "man" )
    {
      create_label( "#effects", effect );
    }
  };
  
  this.add_effect = function( effect )
  {
    this.add_effect_no_start( effect );    
    effect.start();
  };
  
  this.remove_effect = function( ix )
  {
    var effect = this.effects[ix];
    effect.finish();
    $("#effect" + effect.id).remove();
    this.effects.remove( ix );
  };
  
  this.remove_effects_for_target = function( target_id )
  {
    for( var ix = this.effects.length - 1; ix >= 0; --ix )
    {
      if( this.effects[ix].target_id == target_id )
      {
        this.effects.remove( ix );
      }
    }
  };
  
  this.replace_effect = function( old_effect, new_effect )
  {
    for( var ix = 0; ix < this.effects.length; ++ix )
    {
      if( this.effects[ix].id == old_effect.id )
      {
        new_effect.id = old_effect.id;
        this.effects[ix] = new_effect;
        break;
      }
    }
  };
  
  this.run_effects = function( clock )
  {
    for( var ix = this.effects.length - 1; ix >= 0; --ix )
    {
      this.effects[ix].tick();
      
      if( clock.time >= this.effects[ix].finish_time )
      {
        this.remove_effect( ix );        
      }
    }
  };
  
  this.get_existing_effect_for_target = function( target_id, status_id, type )
  {
    for( var ix = 0; ix < this.effects.length; ++ix )
    {
      if( this.effects[ix].target_id == target_id && this.effects[ix].type == type && ( type == STATUS_EFFECT_TYPE_POISON || this.effects[ix].status_id == status_id ) )
      {
        return this.effects[ix];
      }
    }
    
    return null;
  };
  
  this.load = function( obj )
  {
    this.effects = [];
    $("#effects").empty();
    if( obj == undefined ) return;
    
    for( var ix = obj.length - 1; ix >= 0; --ix )
    {
      var xml = Loader.get_status_effect_data( obj[ix].status_id );
      var effect = null;
      
      switch( obj[ix].type )
      {
        case STATUS_EFFECT_TYPE_POISON:
          effect = new PeriodicDamageStatusEffect( xml ); break;
        case STATUS_EFFECT_TYPE_PASSIVE_BUFF:
        case STATUS_EFFECT_TYPE_PASSIVE_DEBUFF:
          effect = new PassiveStatChangeStatusEffect( xml ); break;
        default:
          effect = new StatusEffect( xml );
      }
      
      effect.load( obj[ix] );
      this.add_effect_no_start( effect );
    }
  };
};

function create_or_replace_status_effect( xml, target_actor, OBJ_TYPE )
{
  var new_effect = new OBJ_TYPE( xml );
  var old_effect = StatusEffects.get_existing_effect_for_target( target_actor.id, new_effect.status_id, new_effect.type );
  new_effect.target_id   = target_actor.id;
  
  if( !old_effect )
  {
    StatusEffects.add_effect( new_effect );
    Log.debug( "Adding new effect." );
  }
  else if( new_effect.is_stronger( old_effect ) )
  {
    StatusEffects.replace_effect( old_effect, new_effect );
    new_effect.start();
    $("#effect" + new_effect.id).text( new_effect.description ); // Update the text on the existing label
    Log.debug( "Upgrading existing effect to stronger version." );
  }
  else if( old_effect.status_id == new_effect.status_id )
  {
    old_effect.reset_time( xml );
    Log.debug( "Extending duration of existing effect." );
  }
}

function create_status_effect( status_id, target_actor )
{
  var xml = Loader.get_status_effect_data( status_id );
  var type = parseInt( xml.attr("type") );
  
  switch( type )
  {
    case STATUS_EFFECT_TYPE_POISON:
      create_or_replace_status_effect( xml, target_actor, PeriodicDamageStatusEffect ); break;
    case STATUS_EFFECT_TYPE_PASSIVE_BUFF:
    case STATUS_EFFECT_TYPE_PASSIVE_DEBUFF:
      create_or_replace_status_effect( xml, target_actor, PassiveStatChangeStatusEffect ); break;
    default:
    {
      var effect = new StatusEffect( xml );
      effect.target_id   = target_actor.id;
      StatusEffects.add_effect( effect );
    }
  }
}

function StatusEffect( xml )
{
  StatusEffect.base_constructor.call( this );
  
  this.reset_time = function( xml )
  {
    this.finish_time = xml.has("Rounds").length ? Time.time + ( parseInt( xml.find("Rounds").text() ) * TIME_STANDARD_MOVE ) : Number.MAX_VALUE;
  };
  
  this.id          = StatusEffect.max_status_id;
  this.status_id   = parseInt( xml.attr("id") );
  this.description = xml.find("Description").text();
  this.type        = parseInt( xml.attr("type") );
  this.finish_time = Number.MAX_VALUE;
  this.target_id   = null;
  
  this.reset_time( xml );
  StatusEffect.max_status_id = Math.max( this.id + 1, StatusEffect.max_status_id + 1 );
}
extend( StatusEffect, Serializable );

StatusEffect.max_status_id = 0;

StatusEffect.prototype.start  = function() {};
StatusEffect.prototype.tick   = function() {};
StatusEffect.prototype.finish = function() {};
StatusEffect.prototype.is_stronger = function( that ) { return false; };

function PeriodicDamageStatusEffect( xml )
{
  PeriodicDamageStatusEffect.base_constructor.call( this, xml );
  
  this.damage = parseInt( xml.find("Damage").text() );
}
extend( PeriodicDamageStatusEffect, StatusEffect );

PeriodicDamageStatusEffect.prototype.start = function()
{
  if( this.target_id == "man" )
  {
    Log.add( "You are affected by " + this.description + "!" );
  }
};

PeriodicDamageStatusEffect.prototype.tick = function()
{
  if( this.target_id == "man" )
  {
    Player.damage( this.damage );
    Log.add( "The " + this.description + " continues to hurt you!" );
  }
  else
  {
    var monster = Dungeon.get_monster_by_id( this.target_id );
    if( monster )
    {
      monster.damage( this.damage );
      Log.add( "The " + this.description + " continues to hurt the " + monster.description + "!" );
    }
  }
};

PeriodicDamageStatusEffect.prototype.finish = function()
{
  if( this.target_id == "man" )
  {
    Log.add( "The effects of the " + this.description + " wear off." );
  }
};

PeriodicDamageStatusEffect.prototype.is_stronger = function( that )
{
  return this.damage > that.damage;
};

function PassiveStatChangeStatusEffect( xml )
{
  PassiveStatChangeStatusEffect.base_constructor.call( this, xml );
  
  this.get_effect = function()
  {
    return Loader.get_status_effect_data( this.status_id ).find("Effect");
  };
}
extend( PassiveStatChangeStatusEffect, StatusEffect );

PassiveStatChangeStatusEffect.prototype.start = function()
{
  if( this.target_id == "man" )
  {
    Player.apply_effect( this.get_effect() );
    Log.add( "You are affected by " + this.description + "!" );
  }
};

PassiveStatChangeStatusEffect.prototype.finish = function()
{
  if( this.target_id == "man" )
  {
    Player.remove_effect( this.get_effect() );
    Log.add( "The effects of the " + this.description + " wear off." );
  }
};

PassiveStatChangeStatusEffect.prototype.is_stronger = function( that )
{
  return true;
};