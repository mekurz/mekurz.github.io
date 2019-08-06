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
}