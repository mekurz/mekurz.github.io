var MAP_WIDTH  = 50;
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
}