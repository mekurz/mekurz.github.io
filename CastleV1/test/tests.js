function MockLogger()
{
  this.add = function( str )
  {
    console.log( str );
  };
  
  this.debug = function( str )
  {
    console.log( str );
  };
}

Log = new MockLogger();

function run_unit_tests()
{
  MAP_HEIGHT = 100;
  MAP_WIDTH = 100;
  
  MapGenerator_allocate_map();
  MapGenerator_block_map_edge();
 
  Cell_is_a_room();
  Cell_set_as_perimeter();
  
  Room_contains_point();
  Room_fits_on_map();
  Room_contains_any_blocked_cell();
  Room_draw_perimeter();
  Room_fill_room();
  Room_get_room_center();
  
  DoorMaker_count_existing_doors_for_room();
  DoorMaker_add_valid_horizontal_sills();
  
  GameTime_get_time();
  
  StatusEffectsManager_add_effect();
  StatusEffectsManager_run_effects();
  StatusEffectsManager_stronger_replaces_weak();
}

function MapGenerator_allocate_map()
{
  module( "MapGenerator - allocate_map" );
  var mapgen = new MapGenerator();
  mapgen.allocate_map();
  
  test( "Map Dimensions", function()  
  {  
    equal( mapgen.map.length, MAP_HEIGHT, "Check height" );
    equal( mapgen.map[0].length, MAP_WIDTH, "Check width" );
  });
  
  test( "Map Contents", function()  
  {  
    var all_cells = true;
     
    for( var row = 0; row < MAP_HEIGHT && all_cells; row++ )
    {
      for( var col = 0; col < MAP_WIDTH && all_cells; col++ )
      {
        if( mapgen.map[row][col] instanceof Cell == false )
        {
          all_cells = false;
        }
      }
    }
    
    ok( all_cells, "Check that all Cells have been created" );
  });
}

function MapGenerator_block_map_edge()
{
  module( "MapGenerator - block_map_edge" );
  var mapgen = new MapGenerator();
  mapgen.allocate_map();
  mapgen.block_map_edge();
  
  test( "Horizontals", function()  
  {  
    var all_cells = true;
     
    for( var col = 0; col < MAP_WIDTH; col++ )
    {
      if( !mapgen.map[0][col].blocked || !mapgen.map[MAP_HEIGHT-1][col].blocked )
      {
        all_cells = false;
        break;
      }
    }
    
    ok( all_cells, "Check that top and bottom rows are blocked" );
  });
  
  test( "Verticals", function()  
  {  
    var all_cells = true;
     
    for( var row = 0; row < MAP_HEIGHT; row++ )
    {
      if( !mapgen.map[row][0].blocked || !mapgen.map[row][MAP_WIDTH-1].blocked )
      {
        all_cells = false;
        break;
      }
    }
    
    ok( all_cells, "Check that left and right columns are blocked" );
  });
}

function Cell_is_a_room()
{
  module( "Cell - is_a_room" );
    
  test( "Default", function()  
  {  
    var cell = new Cell();
    equal( cell.room_id, -1, "Default room_id is -1" );
    ok( !cell.is_a_room(), "New cells are not rooms" );
  });

  test( "Room ID set", function()  
  {  
    var cell = new Cell();
    cell.room_id = 999;
    ok( cell.is_a_room(), "Check that cell is a room" );
  });
}

function Cell_set_as_perimeter()
{
  module( "Cell - set_as_perimeter" );
    
  test( "Default", function()  
  {  
    var cell = new Cell();
    equal( cell.room_id, -1, "Default room_id is -1" );
    equal( cell.blocked, false, "Cell is not blocked" );
    
    cell.set_as_perimeter();
    ok( cell.is_perimeter, "Unblocked non-room cells can be marked as a perimeter" );
  });
  
  test( "Blocked Cells", function()  
  {  
    var cell = new Cell();
    equal( cell.room_id, -1, "Default room_id is -1" );
    cell.blocked = true;    
    cell.set_as_perimeter();
    ok( !cell.is_perimeter, "Blocked cells cannot be marked as a perimeter" );
  });

  test( "Room Cells", function()  
  {  
    var cell = new Cell();
    equal( cell.blocked, false, "Cell is not blocked" );
    
    cell.room_id = 999;
    cell.set_as_perimeter();
    ok( !cell.is_perimeter, "Blocked cells cannot be marked as a perimeter" );
  });
}

function Room_contains_point()
{
  module( "Room - contains_point" );
  var room = new Room();
  room.top_left = new Point( 1, 1 );
  room.width = 5;
  room.height = 7;
  
  test( "Outer cells", function()  
  {  
    ok( !room.contains_point( 7, 9 ), "Check (7,9)" );
    ok( !room.contains_point( 0, 0 ), "Check (0,0)" );
    ok( !room.contains_point( 100, 100 ), "Check (100,100)" );
    ok( !room.contains_point( -10, -10 ), "Check (-10,-10)" );
  });
  
  test( "Contains all internal cells", function()  
  {  
    var all_cells = true;
     
    for( var row = room.top_left.y; row < room.top_left.y + room.height && all_cells; row++ )
    {
      for( var col = room.top_left.x; col < room.top_left.x + room.width && all_cells; col++ )
      {
        if( !room.contains_point( col, row ) )
        {
          all_cells = false;
        }
      }
    }
    
    ok( all_cells, "Check that all cells inside the room count as contained by the room" );
  });
}

function Room_fits_on_map()
{
  module( "Room - fits_on_map" );
  
  test( "Room fits completely", function()  
  {  
    var room = new Room();
    room.top_left = new Point( 1, 1 );
    room.width = 5;
    room.height = 7;
    
    ok( room.fits_on_map(), "Room fits on map" );
  });
  
  test( "Room overlaps TOP", function()  
  {  
    var room = new Room();
    room.top_left = new Point( 51, -1 );
    room.width = 5;
    room.height = 7; 
    ok( !room.fits_on_map(), "Room fits on map" );
  });

  test( "Room overlaps BOTTOM", function()  
  {  
    var room = new Room();
    room.top_left = new Point( 51, MAP_HEIGHT - 11 );
    room.width = 5;
    room.height = 13; 
    ok( !room.fits_on_map(), "Room fits on map" );
  });
  
  test( "Room overlaps RIGHT", function()  
  {  
    var room = new Room();
    room.top_left = new Point( -2, 51 );
    room.width = 5;
    room.height = 7; 
    ok( !room.fits_on_map(), "Room fits on map" );
  });
  
  test( "Room overlaps LEFT", function()  
  {  
    var room = new Room();
    room.top_left = new Point( MAP_WIDTH - 7, 51 );
    room.width = 13;
    room.height = 7; 
    ok( !room.fits_on_map(), "Room fits on map" );
  });
  
  test( "Room overlaps BOTTOM and LEFT", function()  
  {  
    var room = new Room();
    room.top_left = new Point( MAP_WIDTH - 7, MAP_HEIGHT - 7 );
    room.width = 13;
    room.height = 13; 
    ok( !room.fits_on_map(), "Room fits on map" );
  });
}

function Room_contains_any_blocked_cell()
{
  module( "Room - contains_any_blocked_cell" );
  var mapgen = new MapGenerator();
  mapgen.allocate_map();
  mapgen.map[10][10].blocked = true;  // Block a cell  
  mapgen.map[10][30].room_id = 999;  // Make a cell part of a room  
  
  test( "Room is unblocked", function()  
  {  
    var room = new Room();
    room.top_left = new Point( 20, 20 );
    room.width = 5;
    room.height = 5; 
    ok( !room.contains_any_blocked_cell( mapgen.map ), "All cells are unblocked" );
  });
  
  test( "Blocked cell", function()  
  {  
    var room = new Room();
    room.top_left = new Point( 8, 8 );
    room.width = 5;
    room.height = 5; 
    ok( room.contains_any_blocked_cell( mapgen.map ), "Check that room is blocked" );
  });
  
  test( "Blocked by another room", function()  
  {  
    var room = new Room();
    room.top_left = new Point( 28, 8 );
    room.width = 5;
    room.height = 5; 
    ok( room.contains_any_blocked_cell( mapgen.map ), "Check that room is blocked" );
  });
}

function Room_draw_perimeter()
{
  module( "Room - draw_perimeter" );
  var mapgen = new MapGenerator();
  mapgen.allocate_map();
  
  var room = new Room();
  room.top_left = new Point( 8, 8 );
  room.width = 5;
  room.height = 5;
  
  room.draw_perimeter( mapgen.map );
  
  test( "Perimeter is drawn", function()
  {
    var all_cells = true;
     
    for( var row = 0; row < MAP_HEIGHT && all_cells; row++ )
    {
      for( var col = 0; col < MAP_WIDTH && all_cells; col++ )
      {
        if( ( ( row == 7 || row == 13 ) && col >= 7 && col <= 13 )
          ||( ( col == 7 || col == 13 ) && row >= 7 && row <= 13 ) )
        {
          all_cells = mapgen.map[row][col].is_perimeter;
        }
        else
        {
          all_cells = !mapgen.map[row][col].is_perimeter; 
        }
      }
    }
    
    ok( all_cells, "Check that perimeter is drawn correctly" );
  });
}

function Room_fill_room()
{
  module( "Room - fill_room" );
  var mapgen = new MapGenerator();
  mapgen.allocate_map();
  
  var room = new Room();
  room.top_left = new Point( 8, 8 );
  room.room_id = 1;
  room.width = 5;
  room.height = 5;
  
  room.fill_room( mapgen.map );
  
  test( "Room is filled", function()
  {
    var all_cells = true;
     
    for( var row = 0; row < MAP_HEIGHT && all_cells; row++ )
    {
      for( var col = 0; col < MAP_WIDTH && all_cells; col++ )
      {
        if( row >= 8 && row <= 12 && col >= 8 && col <= 12 )
        {
          all_cells = mapgen.map[row][col].is_a_room();
        }
        else
        {
          all_cells = !mapgen.map[row][col].is_a_room(); 
        }
      }
    }
    
    ok( all_cells, "Check that the room is filled correctly" );
  });
}

function Room_get_room_center()
{
  module( "Room - get_room_center" );
 
  var room = new Room();
  room.top_left = new Point( 8, 8 );
  
  test( "Square room", function()
  {
    room.width = 5;
    room.height = 5;
    var center = room.get_room_center();
    equal( center.x, 10, "Check that X is correct" );
    equal( center.y, 10, "Check that Y is correct" );
  });
  
  test( "Wide room", function()
  {
    room.width = 11;
    room.height = 5;
    var center = room.get_room_center();
    equal( center.x, 13, "Check that X is correct" );
    equal( center.y, 10, "Check that Y is correct" );
  });
  
  test( "Tall room", function()
  {
    room.width = 5;
    room.height = 13;
    var center = room.get_room_center();
    equal( center.x, 10, "Check that X is correct" );
    equal( center.y, 14, "Check that Y is correct" );
  });
}

function DoorMaker_count_existing_doors_for_room()
{
  module( "DoorMaker - count_existing_doors_for_room" );
  var mapgen = new MapGenerator();
  mapgen.allocate_map();
  
  test( "Room has no doors", function()
  {
    var room = new Room();
    room.top_left = new Point( 8, 8 );
    room.width = 5;
    room.height = 5;
    room.place_room( mapgen.map );
    
    var doors = new DoorMaker( mapgen.map, room );
    
    equal( doors.count_existing_doors_for_room(), 0, "Check that there are no doors attached to a room" );
  });
  
  test( "Corner cells don't get counted", function()
  {
    var room = new Room();
    room.top_left = new Point( 8, 8 );
    room.width = 5;
    room.height = 5;
    room.place_room( mapgen.map );
    mapgen.map[7][7].is_entrance = true;
    mapgen.map[7][13].is_entrance = true;
    mapgen.map[13][7].is_entrance = true;
    mapgen.map[13][13].is_entrance = true;
    
    var doors = new DoorMaker( mapgen.map, room );
    
    equal( doors.count_existing_doors_for_room(), 0, "Check that corner cells don't get counted for doors" );
  });
  
  test( "Has 3 doors", function()
  {
    var room = new Room();
    room.top_left = new Point( 8, 8 );
    room.width = 5;
    room.height = 5;
    room.place_room( mapgen.map );
    mapgen.map[7][10].is_entrance = true;
    mapgen.map[10][13].is_entrance = true;
    mapgen.map[13][10].is_entrance = true;
    
    var doors = new DoorMaker( mapgen.map, room );
    
    equal( doors.count_existing_doors_for_room(), 3, "Check that Room has 3 doors" );
  });
}

function DoorMaker_add_valid_horizontal_sills()
{
  module( "DoorMaker - add_valid_horizontal_sills" );
  var mapgen = new MapGenerator();
  mapgen.allocate_map();
  
  test( "All NORTH is valid", function()
  {
    var room = new Room();
    var doors = new DoorMaker( mapgen.map, room );
    room.width = 5;
    
    room.top_left = new Point( 8, 3 );
    doors.add_north_sills();
    equal( doors.sills.length, 3, "Check that Room has 3 NORTH sills at ROW 3" );
    doors.sills = new Array();
    
    room.top_left = new Point( 8, 8 );
    doors.add_north_sills();
    equal( doors.sills.length, 3, "Check that Room has 3 NORTH sills at ROW 8" );
    doors.sills = new Array();
  });
  
  test( "No NORTH is valid", function()
  {
    var room = new Room();
    var doors = new DoorMaker( mapgen.map, room );
    room.width = 5;
    
    room.top_left = new Point( 8, 0 );
    doors.add_north_sills();
    equal( doors.sills.length, 0, "Check that Room has 0 NORTH sills at ROW 0" );
    doors.sills = new Array();
    
    room.top_left = new Point( 8, 1 );
    doors.add_north_sills();
    equal( doors.sills.length, 0, "Check that Room has 0 NORTH sills at ROW 1" );
    doors.sills = new Array();
    
    room.top_left = new Point( 8, 2 );
    doors.add_north_sills();
    equal( doors.sills.length, 0, "Check that Room has 0 NORTH sills at ROW 2" );
    doors.sills = new Array();
  });
  
  test( "NORTH has 1 sill", function()
  {
    var room = new Room();
    var doors = new DoorMaker( mapgen.map, room );
       
    room.top_left = new Point( 7, 7 );
    room.width = 7;
    
    mapgen.map[6][7].blocked = true;    // One perimeter cell is blocked
    mapgen.map[6][9].is_entrance = true;   // One perimeter cell is already an entrance (i.e. from a different room)
    mapgen.map[5][11].blocked = true;   // One possible entrance would open onto a blocked cell
    
    doors.add_north_sills();
    equal( doors.sills.length, 1, "Check that Room has 1 NORTH sill" );
  });
  
  test( "All SOUTH is valid", function()
  {
    var room = new Room();
    var doors = new DoorMaker( mapgen.map, room );
    room.width = 5;
    room.height = 0;
    
    room.top_left = new Point( 8, MAP_HEIGHT-2 );
    doors.add_south_sills();
    equal( doors.sills.length, 3, "Check that Room has 3 SOUTH sills at ROW MAP_HEIGHT-2" );
    doors.sills = new Array();
    
    room.top_left = new Point( 8, 8 );
    doors.add_south_sills();
    equal( doors.sills.length, 3, "Check that Room has 3 SOUTH sills at ROW 8" );
    doors.sills = new Array();
  });
  
  test( "No SOUTH is valid", function()
  {
    var room = new Room();
    var doors = new DoorMaker( mapgen.map, room );
    room.width = 5;
    room.height = 0;
    
    room.top_left = new Point( 8, MAP_HEIGHT-1 );
    doors.add_south_sills();
    equal( doors.sills.length, 0, "Check that Room has 0 SOUTH sills at ROW MAP_HEIGHT-1" );
    doors.sills = new Array();
    
    room.top_left = new Point( 8, MAP_HEIGHT );
    doors.add_south_sills();
    equal( doors.sills.length, 0, "Check that Room has 0 SOUTH sills at ROW MAP_HEIGHT" );
    doors.sills = new Array();
  });
  
  test( "SOUTH has 1 sill", function()
  {
    var room = new Room();
    var doors = new DoorMaker( mapgen.map, room );
       
    room.top_left = new Point( 7, 7 );
    room.width = 7;
    room.height = 5;
    
    mapgen.map[12][7].blocked = true;    // One perimeter cell is blocked
    mapgen.map[12][9].is_entrance = true;   // One perimeter cell is already an entrance (i.e. from a different room)
    mapgen.map[13][11].blocked = true;   // One possible entrance would open onto a blocked cell
    
    doors.add_south_sills();
    equal( doors.sills.length, 1, "Check that Room has 1 SOUTH sill" );
  });
}

function GameTime_get_time()
{
  module( "GameTime - get_time" );
  var time = new GameTime();
  
  test( "Zero", function()
  {
    time.time = 0;
    equal( time.get_time(), "00:00" );
  });
  
  test( "Thirty seconds", function()
  {
    time.time = 30;
    equal( time.get_time(), "00:30" );
  });
  
  test( "Sixty seconds", function()
  {
    time.time = 60;
    equal( time.get_time(), "01:00" );
  });
  
  test( "Ninety seconds", function()
  {
    time.time = 90;
    equal( time.get_time(), "01:30" );
  });
  
  test( "One hour", function()
  {
    time.time = 3600;
    equal( time.get_time(), "01:00:00" );
  });
  
  test( "One hour, thirty seconds", function()
  {
    time.time = 3630;
    equal( time.get_time(), "01:00:30" );
  });
  
  test( "One hour, sixty seconds", function()
  {
    time.time = 3660;
    equal( time.get_time(), "01:01:00" );
  });
  
  test( "One hour, ninety seconds", function()
  {
    time.time = 3690;
    equal( time.get_time(), "01:01:30" );
  });
  
  test( "One day", function()
  {
    time.time = 86400;
    equal( time.get_time(), "1d,00:00:00" );
  });
  
  test( "One day, one hour", function()
  {
    time.time = 90000;
    equal( time.get_time(), "1d,01:00:00" );
  });
  
  test( "One day, one hour, thirty seconds", function()
  {
    time.time = 90030;
    equal( time.get_time(), "1d,01:00:30" );
  });
  
  test( "One day, one hour, sixty seconds", function()
  {
    time.time = 90060;
    equal( time.get_time(), "1d,01:01:00" );
  });
  
  test( "One day, one hour, ninety seconds", function()
  {
    time.time = 90090;
    equal( time.get_time(), "1d,01:01:30" );
  });
  
  test( "One second before midnight", function()
  {
    time.time = 86399;
    equal( time.get_time(), "23:59:59" );
  });
}

var $EFFECT_XML = $("<StatusEffect id=\"1\" type=\"0\"><Description>Weak Poison</Description><Damage>1</Damage><Rounds>6</Rounds></StatusEffect>");
var $STRONGER_EFFECT_XML = $("<StatusEffect id=\"2\" type=\"0\"><Description>Strong Poison</Description><Damage>2</Damage><Rounds>6</Rounds></StatusEffect>");

function StatusEffectsManager_add_effect()
{
  module( "StatusEffectsManager - add_effect", { setup: function() { Time = new GameTime(); } } );
  var status_effects = null;
  
  test( "Empty effects list", function()
  {
    status_effects = new StatusEffectsManager();
    equal( status_effects.effects.length, 0 );
  });
  
  test( "One effect", function()
  {
    status_effects = new StatusEffectsManager();
    var effect = new StatusEffect( $EFFECT_XML );
    status_effects.add_effect( effect );
    equal( status_effects.effects.length, 1 );
  });
  
  test( "New effects are added to the front", function()
  {
    StatusEffect.max_status_id = 0;
    status_effects = new StatusEffectsManager();
    add_several_effects( status_effects );
    
    for( var ix = 0; ix < 5; ++ix )
    {
      equal( status_effects.effects[ix].id, 4 - ix );
    }
  });
  
  test( "Remove an effect", function()
  {
    status_effects = new StatusEffectsManager();
    add_several_effects( status_effects );
    equal( status_effects.effects.length, 5, "Confirm size before removal" );
    status_effects.remove_effect( 2 );
    equal( status_effects.effects.length, 4, "Confirm size after removal" );
    
    for( var ix = 0; ix < status_effects.effects.length; ++ix )
    {
      notEqual( status_effects.effects[ix].id, 2, "Confirm the deleted index no longer exists" );
    }
    
  });
}

function add_several_effects( status_effects )
{
  for( var ix = 0; ix < 5; ++ix )
  {
    status_effects.add_effect( new StatusEffect( $EFFECT_XML ) );
  }
}

function MockStatusEffect()
{
  MockStatusEffect.base_constructor.call( this, $EFFECT_XML );
  
  this.start_count  = 0;
  this.tick_count   = 0;
  this.finish_count = 0;
}
extend( MockStatusEffect, StatusEffect );

MockStatusEffect.prototype.start  = function() { this.start_count++; };
MockStatusEffect.prototype.tick   = function() { this.tick_count++; };
MockStatusEffect.prototype.finish = function() { this.finish_count++; };

function StatusEffectsManager_run_effects()
{
  module( "StatusEffectsManager - run_effects", { setup: function() { Time = new GameTime(); } }  );
  var status_effects = new StatusEffectsManager();
  
  test( "Running one effect with 10 ticks", function()
  {
    var effect = new MockStatusEffect();
    effect.finish_time = 60;
    
    status_effects.add_effect( effect );
    equal( status_effects.effects.length, 1, "Confirm size before running effects" );
    
    for( var ix = 0; ix < 20; ++ix )
    {
      Time.add_time( TIME_STANDARD_MOVE );
      status_effects.run_effects( Time );
    }
    
    equal( status_effects.effects.length, 0, "Confirm size after running effects" );
    equal( effect.start_count, 1, "Confirm number of times start() is called" );
    equal( effect.tick_count, 10, "Confirm number of times tick() is called" );
    equal( effect.finish_count, 1, "Confirm number of times finish() is called" );
  });
}

function MockPlayer()
{
  this.id = "man";
  
  this.damage = function() {};
}

function StatusEffectsManager_stronger_replaces_weak()
{
  module( "StatusEffectsManager - stronger_replaces_weak", { setup: function() { 
                                                                      Time = new GameTime();
                                                                      StatusEffects = new StatusEffectsManager();
                                                                      Player = new MockPlayer();
                                                                    }
                                                            } );
  
  test( "Replace a weak poison with a stronger poison", function()
  {
    create_or_replace_status_effect( $EFFECT_XML, Player, PeriodicDamageStatusEffect );
    equal( StatusEffects.effects.length, 1, "Confirm size after adding Weak Poison" );
    equal( StatusEffects.effects[0].status_id, 1, "Confirm effect queue contains Weak Poison" );
    equal( StatusEffects.effects[0].finish_time, 36, "Confirm finish time for Weak Poison is its own" );
    
    // Increment one turn to modify the effect in order to observe extension
    Time.add_time( TIME_STANDARD_MOVE );
    StatusEffects.run_effects( Time );
    
    create_or_replace_status_effect( $STRONGER_EFFECT_XML, Player, PeriodicDamageStatusEffect );
    
    equal( StatusEffects.effects.length, 1, "Confirm size is still 1 after adding Strong Poison" );
    equal( StatusEffects.effects[0].status_id, 2, "Confirm effect queue contains Strong Poison" );
    equal( StatusEffects.effects[0].finish_time, 42, "Confirm finish time for Strong Poison is its own" );
  });
  
  test( "Extend an effect", function()
  {
    create_or_replace_status_effect( $EFFECT_XML, Player, PeriodicDamageStatusEffect );
    equal( StatusEffects.effects.length, 1, "Confirm size after adding Weak Poison" );
    equal( StatusEffects.effects[0].status_id, 1, "Confirm effect queue contains Weak Poison" );
    equal( StatusEffects.effects[0].finish_time, 36, "Confirm finish time for Weak Poison is its own" );
    
    // Increment one turn to modify the effect in order to observe extension
    Time.add_time( TIME_STANDARD_MOVE );
    StatusEffects.run_effects( Time );
    
    create_or_replace_status_effect( $EFFECT_XML, Player, PeriodicDamageStatusEffect );
    
    equal( StatusEffects.effects.length, 1, "Confirm size is still 1 after reapplying Weak Poison" );
    equal( StatusEffects.effects[0].status_id, 1, "Confirm effect queue contains Weak Poison" );
    equal( StatusEffects.effects[0].finish_time, 42, "Confirm finish time for Weak Poison has been updated" );
  });
}
