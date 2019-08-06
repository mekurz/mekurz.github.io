var VIEWPORT_WIDTH  = 30;
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
